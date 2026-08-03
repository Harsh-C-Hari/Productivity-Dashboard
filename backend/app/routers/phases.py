"""
CRUD endpoints for Project Phases (ordered roadmap stages within a
project). Deleting a phase never deletes the work items grouped under
it -- see `models.ProjectPhase`'s docstring; SQLAlchemy nulls out their
`phase_id` automatically at flush time.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/phases", tags=["project-workspace"])


def serialize_phase(phase: models.ProjectPhase) -> schemas.ProjectPhaseOut:
    return schemas.ProjectPhaseOut.model_validate(phase)


def get_phase_or_404(db: Session, phase_id: str) -> models.ProjectPhase:
    phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == phase_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")
    return phase


def build_phase_summary(db: Session, phase: models.ProjectPhase) -> schemas.ProjectPhaseSummary:
    features = db.query(models.Feature).filter(models.Feature.phase_id == phase.id).all()
    todos = db.query(models.ProjectTodo).filter(models.ProjectTodo.phase_id == phase.id).all()
    bugs = db.query(models.Bug).filter(models.Bug.phase_id == phase.id).all()
    milestones = db.query(models.Milestone).filter(models.Milestone.phase_id == phase.id).all()

    total_items = len(todos) + len(bugs)
    completed_items = len([t for t in todos if t.status == models.TaskStatus.done]) + len(
        [b for b in bugs if b.status == models.BugStatus.resolved]
    )
    completion_rate = round(completed_items / total_items * 100, 1) if total_items else 0.0

    return schemas.ProjectPhaseSummary(
        phase=serialize_phase(phase),
        feature_count=len(features),
        todo_count=len(todos),
        bug_count=len(bugs),
        milestone_count=len(milestones),
        completion_rate=completion_rate,
    )


@router.get("", response_model=List[schemas.ProjectPhaseOut])
def list_phases(
    project_id: str = Query(..., description="Only phases on this project are ever returned."),
    status: Optional[models.PhaseStatus] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user, project_id, "view_tasks")
    query = db.query(models.ProjectPhase).filter(models.ProjectPhase.project_id == project_id)
    if status:
        query = query.filter(models.ProjectPhase.status == status)
    phases = query.order_by(models.ProjectPhase.order_index.asc(), models.ProjectPhase.created_at.asc()).all()
    return [serialize_phase(p) for p in phases]


@router.get("/{phase_id}", response_model=schemas.ProjectPhaseOut)
def get_phase(phase_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    phase = get_phase_or_404(db, phase_id)
    require_project_access(db, current_user, phase.project_id, "view_tasks")
    return serialize_phase(phase)


@router.get("/{phase_id}/summary", response_model=schemas.ProjectPhaseSummary)
def get_phase_summary(phase_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    phase = get_phase_or_404(db, phase_id)
    require_project_access(db, current_user, phase.project_id, "view_tasks")
    return build_phase_summary(db, phase)


@router.post("", response_model=schemas.ProjectPhaseOut, status_code=201)
def create_phase(payload: schemas.ProjectPhaseCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, payload.project_id, "manage_tasks")

    phase = models.ProjectPhase(**payload.model_dump())
    db.add(phase)
    db.commit()
    db.refresh(phase)
    log_activity(db, f'Added phase "{phase.title}" to {project.name}', icon="list-tree")
    log_timeline_event(
        db, project.id, "phase_created", f'Phase "{phase.title}" added',
        related_entity_type="phase", related_entity_id=phase.id, icon="list-tree",
    )
    return serialize_phase(phase)


@router.patch("/{phase_id}", response_model=schemas.ProjectPhaseOut)
def update_phase(phase_id: str, payload: schemas.ProjectPhaseUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    phase = get_phase_or_404(db, phase_id)
    require_project_access(db, current_user, phase.project_id, "manage_tasks")
    was_completed = phase.status == models.PhaseStatus.completed

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(phase, field, value)

    if phase.status == models.PhaseStatus.completed:
        phase.progress = 100
    phase.updated_at = utc_now()
    db.commit()
    db.refresh(phase)

    if phase.status == models.PhaseStatus.completed and not was_completed:
        log_activity(db, f'Completed phase "{phase.title}"', icon="check-circle")
        log_timeline_event(
            db, phase.project_id, "phase_completed", f'Phase "{phase.title}" completed',
            related_entity_type="phase", related_entity_id=phase.id, icon="check-circle",
        )
    else:
        log_activity(db, f'Updated phase "{phase.title}"', icon="pencil")

    return serialize_phase(phase)


class ReorderItem(BaseModel):
    id: str
    order_index: int


@router.post("/reorder", response_model=List[schemas.ProjectPhaseOut])
def reorder_phases(items: List[ReorderItem], current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Bulk-updates order_index for a set of phases in one request, so
    a drag-and-drop roadmap reorder on the frontend is a single call."""
    phases = []
    for item in items:
        phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == item.id).first()
        if not phase:
            raise HTTPException(status_code=404, detail=f"Phase {item.id} not found")
        require_project_access(db, current_user, phase.project_id, "manage_tasks")
        phase.order_index = item.order_index
        phase.updated_at = utc_now()
        phases.append(phase)
    db.commit()
    for phase in phases:
        db.refresh(phase)
    return [serialize_phase(p) for p in sorted(phases, key=lambda p: p.order_index)]


@router.delete("/{phase_id}", status_code=204)
def delete_phase(phase_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Un-groups (does not delete) any features/todos/bugs/milestones
    under this phase -- see `models.ProjectPhase` docstring."""
    phase = get_phase_or_404(db, phase_id)
    require_project_access(db, current_user, phase.project_id, "manage_tasks")
    title = phase.title
    project_id = phase.project_id
    db.delete(phase)
    db.commit()
    log_activity(db, f'Deleted phase "{title}"', icon="trash-2")
    log_timeline_event(db, project_id, "phase_deleted", f'Phase "{title}" deleted', icon="trash-2")
    return None
