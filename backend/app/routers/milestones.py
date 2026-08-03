"""
CRUD endpoints for Milestones (dated checkpoints within a project,
optionally tied to a phase). Supports a `complete_now` convenience flag
on update, the same pattern `study_sessions.StudySessionUpdate` uses.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/milestones", tags=["project-workspace"])


def serialize_milestone(milestone: models.Milestone, phase: Optional[models.ProjectPhase] = None) -> schemas.MilestoneOut:
    out = schemas.MilestoneOut.model_validate(milestone)
    if phase:
        out.phase_title = phase.title
    return out


def get_milestone_or_404(db: Session, milestone_id: str) -> models.Milestone:
    milestone = db.query(models.Milestone).filter(models.Milestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return milestone


def _phase_map(db: Session) -> dict:
    return {p.id: p for p in db.query(models.ProjectPhase).all()}


@router.get("", response_model=List[schemas.MilestoneOut])
def list_milestones(
    project_id: str = Query(..., description="Only milestones on this project are ever returned."),
    phase_id: Optional[str] = None,
    completed: Optional[bool] = None,
    q: Optional[str] = None,
    sort_by: str = Query(default="target_date", pattern="^(target_date|created_at|title)$"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user, project_id, "view_tasks")
    query = db.query(models.Milestone).filter(models.Milestone.project_id == project_id)
    if phase_id:
        query = query.filter(models.Milestone.phase_id == phase_id)
    if completed is not None:
        query = query.filter(models.Milestone.completed == completed)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(models.Milestone.title.ilike(like), models.Milestone.description.ilike(like)))

    if sort_by == "target_date":
        order_col = models.Milestone.target_date.asc() if sort_order == "asc" else models.Milestone.target_date.desc()
        query = query.order_by(models.Milestone.target_date.is_(None), order_col)
    else:
        sort_column = getattr(models.Milestone, sort_by)
        sort_column = sort_column.desc() if sort_order == "desc" else sort_column.asc()
        query = query.order_by(sort_column)

    milestones = query.all()
    phases = _phase_map(db)
    return [serialize_milestone(m, phases.get(m.phase_id)) for m in milestones]


@router.get("/{milestone_id}", response_model=schemas.MilestoneOut)
def get_milestone(milestone_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    milestone = get_milestone_or_404(db, milestone_id)
    require_project_access(db, current_user, milestone.project_id, "view_tasks")
    phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == milestone.phase_id).first() if milestone.phase_id else None
    return serialize_milestone(milestone, phase)


@router.post("", response_model=schemas.MilestoneOut, status_code=201)
def create_milestone(payload: schemas.MilestoneCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, payload.project_id, "manage_tasks")
    phase = None
    if payload.phase_id:
        phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == payload.phase_id).first()
        if not phase:
            raise HTTPException(status_code=404, detail="Phase not found")

    milestone = models.Milestone(**payload.model_dump())
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    log_activity(db, f'Added milestone "{milestone.title}" to {project.name}', icon="flag")
    log_timeline_event(
        db, project.id, "milestone_created", f'Milestone "{milestone.title}" added',
        related_entity_type="milestone", related_entity_id=milestone.id, icon="flag",
    )
    return serialize_milestone(milestone, phase)


@router.patch("/{milestone_id}", response_model=schemas.MilestoneOut)
def update_milestone(milestone_id: str, payload: schemas.MilestoneUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    milestone = get_milestone_or_404(db, milestone_id)
    require_project_access(db, current_user, milestone.project_id, "manage_tasks")
    was_completed = milestone.completed

    data = payload.model_dump(exclude_unset=True)
    clear_target_date = data.pop("clear_target_date", False)
    clear_phase = data.pop("clear_phase", False)
    complete_now = data.pop("complete_now", False)

    if data.get("phase_id"):
        if not db.query(models.ProjectPhase).filter(models.ProjectPhase.id == data["phase_id"]).first():
            raise HTTPException(status_code=404, detail="Phase not found")

    for field, value in data.items():
        setattr(milestone, field, value)
    if clear_target_date:
        milestone.target_date = None
    if clear_phase:
        milestone.phase_id = None

    if complete_now:
        milestone.completed = True

    if milestone.completed and not was_completed:
        milestone.completed_at = utc_now()
    elif not milestone.completed and was_completed:
        milestone.completed_at = None

    milestone.updated_at = utc_now()
    db.commit()
    db.refresh(milestone)

    phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == milestone.phase_id).first() if milestone.phase_id else None

    if milestone.completed and not was_completed:
        log_activity(db, f'Reached milestone "{milestone.title}"', icon="flag")
        log_timeline_event(
            db, milestone.project_id, "milestone_reached", f'Milestone "{milestone.title}" reached',
            related_entity_type="milestone", related_entity_id=milestone.id, icon="flag",
        )
    else:
        log_activity(db, f'Updated milestone "{milestone.title}"', icon="pencil")

    return serialize_milestone(milestone, phase)


@router.delete("/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    milestone = get_milestone_or_404(db, milestone_id)
    require_project_access(db, current_user, milestone.project_id, "manage_tasks")
    title = milestone.title
    db.delete(milestone)
    db.commit()
    log_activity(db, f'Deleted milestone "{title}"', icon="trash-2")
    return None
