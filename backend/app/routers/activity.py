"""
Read APIs over `ActivityLog`, the app's append-only "Recent Activity"
trail (see `activity_log.py` for how entries get written). This module
only adds *read* endpoints -- filtering, pagination, sorting, search --
it does not add a new write path; every router that logs activity keeps
calling `log_activity`/`log_activity_event` directly.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth_dependencies import require_permission

router = APIRouter(prefix="/api/activity", tags=["activity"])


def _query_activity(
    db: Session,
    project_id: Optional[str] = None,
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
    user_id: Optional[str] = None,
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
):
    """General-purpose, fully filterable Activity Log query -- every
    other endpoint in this module is a convenience wrapper around this
    same filter set."""
    entries = _query_activity(
        db, project_id=project_id, user_id=user_id, action=action, entity_type=entity_type,
        entity_id=entity_id, date_from=date_from, date_to=date_to, q=q,
        sort_order=sort_order, limit=limit, offset=offset,
    )
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
    """Recent project activity."""
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
):
    """Recent user activity."""
    entries = _query_activity(
        db, user_id=user_id, action=action, entity_type=entity_type,
        date_from=date_from, date_to=date_to, q=q, sort_order=sort_order, limit=limit, offset=offset,
    )
    return [schemas.ActivityOut.model_validate(e) for e in entries]
