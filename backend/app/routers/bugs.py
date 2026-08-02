"""
CRUD endpoints for Bugs (defect tracking, scoped to a project and
optionally a phase/feature). `resolved_at` is set automatically the
first time a bug's status becomes `resolved`, mirroring the
completed_at pattern in `tasks.py`/`assignments.py`.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/bugs", tags=["project-workspace"])


def serialize_bug(
    bug: models.Bug,
    phase: Optional[models.ProjectPhase] = None,
    feature: Optional[models.Feature] = None,
) -> schemas.BugOut:
    out = schemas.BugOut.model_validate(bug)
    if phase:
        out.phase_title = phase.title
    if feature:
        out.feature_title = feature.title
    return out


def get_bug_or_404(db: Session, bug_id: str) -> models.Bug:
    bug = db.query(models.Bug).filter(models.Bug.id == bug_id).first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    return bug


def _phase_map(db: Session) -> dict:
    return {p.id: p for p in db.query(models.ProjectPhase).all()}


def _feature_map(db: Session) -> dict:
    return {f.id: f for f in db.query(models.Feature).all()}


@router.get("", response_model=List[schemas.BugOut])
def list_bugs(
    project_id: str = Query(..., description="Only bugs on this project are ever returned."),
    phase_id: Optional[str] = None,
    feature_id: Optional[str] = None,
    severity: Optional[models.BugSeverity] = None,
    status: Optional[models.BugStatus] = None,
    q: Optional[str] = None,
    sort_by: str = Query(default="created_at", pattern="^(created_at|updated_at|severity|title)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user, project_id, "view_tasks")
    query = db.query(models.Bug).filter(models.Bug.project_id == project_id)
    if phase_id:
        query = query.filter(models.Bug.phase_id == phase_id)
    if feature_id:
        query = query.filter(models.Bug.feature_id == feature_id)
    if severity:
        query = query.filter(models.Bug.severity == severity)
    if status:
        query = query.filter(models.Bug.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(models.Bug.title.ilike(like), models.Bug.description.ilike(like)))

    sort_column = getattr(models.Bug, sort_by)
    sort_column = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    query = query.order_by(sort_column)

    if limit is not None:
        query = query.offset(offset).limit(limit)

    bugs = query.all()
    phases = _phase_map(db)
    features = _feature_map(db)
    return [serialize_bug(b, phases.get(b.phase_id), features.get(b.feature_id)) for b in bugs]


@router.get("/{bug_id}", response_model=schemas.BugOut)
def get_bug(bug_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    bug = get_bug_or_404(db, bug_id)
    require_project_access(db, current_user, bug.project_id, "view_tasks")
    phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == bug.phase_id).first() if bug.phase_id else None
    feature = db.query(models.Feature).filter(models.Feature.id == bug.feature_id).first() if bug.feature_id else None
    return serialize_bug(bug, phase, feature)


@router.post("", response_model=schemas.BugOut, status_code=201)
def create_bug(payload: schemas.BugCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, payload.project_id, "manage_tasks")
    phase = None
    if payload.phase_id:
        phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == payload.phase_id).first()
        if not phase:
            raise HTTPException(status_code=404, detail="Phase not found")
    feature = None
    if payload.feature_id:
        feature = db.query(models.Feature).filter(models.Feature.id == payload.feature_id).first()
        if not feature:
            raise HTTPException(status_code=404, detail="Feature not found")

    bug = models.Bug(**payload.model_dump())
    db.add(bug)
    db.commit()
    db.refresh(bug)
    log_activity(db, f'Reported bug "{bug.title}" in {project.name}', icon="bug")
    log_timeline_event(
        db, project.id, "bug_reported", f'Bug "{bug.title}" reported',
        related_entity_type="bug", related_entity_id=bug.id, icon="bug",
    )
    return serialize_bug(bug, phase, feature)


@router.patch("/{bug_id}", response_model=schemas.BugOut)
def update_bug(bug_id: str, payload: schemas.BugUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    bug = get_bug_or_404(db, bug_id)
    require_project_access(db, current_user, bug.project_id, "manage_tasks")
    was_resolved = bug.status == models.BugStatus.resolved

    data = payload.model_dump(exclude_unset=True)
    clear_phase = data.pop("clear_phase", False)
    clear_feature = data.pop("clear_feature", False)

    if data.get("phase_id"):
        if not db.query(models.ProjectPhase).filter(models.ProjectPhase.id == data["phase_id"]).first():
            raise HTTPException(status_code=404, detail="Phase not found")
    if data.get("feature_id"):
        if not db.query(models.Feature).filter(models.Feature.id == data["feature_id"]).first():
            raise HTTPException(status_code=404, detail="Feature not found")

    for field, value in data.items():
        setattr(bug, field, value)
    if clear_phase:
        bug.phase_id = None
    if clear_feature:
        bug.feature_id = None

    if bug.status == models.BugStatus.resolved and not was_resolved:
        bug.resolved_at = datetime.utcnow()
    elif was_resolved and bug.status != models.BugStatus.resolved:
        bug.resolved_at = None

    bug.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(bug)

    phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == bug.phase_id).first() if bug.phase_id else None
    feature = db.query(models.Feature).filter(models.Feature.id == bug.feature_id).first() if bug.feature_id else None

    if bug.status == models.BugStatus.resolved and not was_resolved:
        log_activity(db, f'Resolved bug "{bug.title}"', icon="check-circle")
        log_timeline_event(
            db, bug.project_id, "bug_resolved", f'Bug "{bug.title}" resolved',
            related_entity_type="bug", related_entity_id=bug.id, icon="check-circle",
        )
    else:
        log_activity(db, f'Updated bug "{bug.title}"', icon="pencil")

    return serialize_bug(bug, phase, feature)


@router.delete("/{bug_id}", status_code=204)
def delete_bug(bug_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    bug = get_bug_or_404(db, bug_id)
    require_project_access(db, current_user, bug.project_id, "manage_tasks")
    title = bug.title
    db.delete(bug)
    db.commit()
    log_activity(db, f'Deleted bug "{title}"', icon="trash-2")
    return None
