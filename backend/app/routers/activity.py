"""
Read APIs over `ActivityLog`, the app's append-only "Recent Activity"
trail (see `activity_log.py` for how entries get written). This module
only adds *read* endpoints -- filtering, pagination, sorting, search --
it does not add a new write path; every router that logs activity keeps
calling `log_activity`/`log_activity_event` directly.

Data-isolation rule for this module: an ActivityLog row is visible to a
user if it's either (a) attributable to them personally (`user_id`
matches) or (b) attributable to a project they can access (`project_id`
in `get_accessible_project_ids`). Every endpoint below enforces that --
none of them trust a caller-supplied `project_id`/`user_id` query param
on its own, since that was the actual leak (anyone could ask for any
other user's or any other project's activity).
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth_dependencies import get_current_user, require_permission
from ..project_helpers import get_accessible_project_ids

router = APIRouter(prefix="/api/activity", tags=["activity"])


def _query_activity(
    db: Session,
    project_id: Optional[str] = None,
    project_id_in: Optional[List[str]] = None,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    q: Optional[str] = None,
    sort_order: str = "desc",
    limit: int = 50,
    offset: int = 0,
) -> List[models.ActivityLog]:
    query = db.query(models.ActivityLog)
    if project_id:
        query = query.filter(models.ActivityLog.project_id == project_id)
    if project_id_in is not None:
        query = query.filter(models.ActivityLog.project_id.in_(project_id_in))
    if user_id:
        query = query.filter(models.ActivityLog.user_id == user_id)
    if action:
        query = query.filter(models.ActivityLog.action == action)
    if entity_type:
        query = query.filter(models.ActivityLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(models.ActivityLog.entity_id == entity_id)
    if date_from:
        query = query.filter(models.ActivityLog.created_at >= date_from)
    if date_to:
        query = query.filter(models.ActivityLog.created_at <= date_to)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(models.ActivityLog.message.ilike(like), models.ActivityLog.action.ilike(like)))

    sort_column = models.ActivityLog.created_at
    sort_column = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    query = query.order_by(sort_column)

    return query.offset(offset).limit(limit).all()


@router.get("", response_model=List[schemas.ActivityOut])
def list_activity(
    project_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    q: Optional[str] = Query(default=None, description="Search within message/action text"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """General-purpose Activity Log query, scoped to what the current
    user can see: their own personal entries, plus entries for any
    project they have access to. `project_id`, if given, narrows to
    that one project -- but only if the current user can access it."""
    if project_id:
        if project_id not in get_accessible_project_ids(db, current_user.id):
            raise HTTPException(status_code=404, detail="Project not found")
        entries = _query_activity(
            db, project_id=project_id, action=action, entity_type=entity_type,
            entity_id=entity_id, date_from=date_from, date_to=date_to, q=q,
            sort_order=sort_order, limit=limit, offset=offset,
        )
    else:
        # No project filter requested -- union of "my personal activity"
        # and "activity on projects I can access". SQLite/SQLAlchemy has
        # no simple portable OR-across-two-independent-filters helper
        # here, so this fetches the personal slice and the project slice
        # separately and merges, same approach `search.py` already uses
        # for cross-entity search.
        personal = _query_activity(
            db, user_id=current_user.id, action=action, entity_type=entity_type,
            entity_id=entity_id, date_from=date_from, date_to=date_to, q=q,
            sort_order=sort_order, limit=limit, offset=offset,
        )
        accessible_project_ids = get_accessible_project_ids(db, current_user.id)
        project_entries = _query_activity(
            db, project_id_in=accessible_project_ids, action=action, entity_type=entity_type,
            entity_id=entity_id, date_from=date_from, date_to=date_to, q=q,
            sort_order=sort_order, limit=limit, offset=offset,
        ) if accessible_project_ids else []
        merged = {e.id: e for e in personal + project_entries}
        entries = sorted(
            merged.values(), key=lambda e: e.created_at, reverse=(sort_order == "desc")
        )[offset: offset + limit]
    return [schemas.ActivityOut.model_validate(e) for e in entries]


@router.get("/projects/{project_id}", response_model=List[schemas.ActivityOut])
def get_project_activity(
    project_id: str,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    q: Optional[str] = None,
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_permission("view_project")),
):
    """Recent project activity. `require_permission("view_project")`
    already 403s anyone who isn't the owner or a member of `project_id`
    (read via the `project_id` path param, per `auth_dependencies.py`)."""
    entries = _query_activity(
        db, project_id=project_id, action=action, entity_type=entity_type,
        date_from=date_from, date_to=date_to, q=q, sort_order=sort_order, limit=limit, offset=offset,
    )
    return [schemas.ActivityOut.model_validate(e) for e in entries]


@router.get("/users/{user_id}", response_model=List[schemas.ActivityOut])
def get_user_activity(
    user_id: str,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    q: Optional[str] = None,
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Recent activity for one user. A personal feed is only ever the
    caller's own -- there is no "view someone else's personal activity"
    feature, so a mismatched `user_id` is treated as not found rather
    than leaking whether that user/activity exists."""
    if user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    entries = _query_activity(
        db, user_id=user_id, action=action, entity_type=entity_type,
        date_from=date_from, date_to=date_to, q=q, sort_order=sort_order, limit=limit, offset=offset,
    )
    return [schemas.ActivityOut.model_validate(e) for e in entries]
