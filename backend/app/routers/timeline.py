"""
Endpoints for a project's Timeline (an append-only event trail, the
project-scoped analogue of ActivityLog). Every other Project Workspace
router writes to this table through `project_helpers.log_timeline_event`
whenever something notable happens; this router exposes reading that
trail plus a manual-entry endpoint for events with no natural router
home (e.g. "shipped v1.2", a freeform milestone note).
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/timeline", tags=["project-workspace"])


def serialize_event(event: models.TimelineEvent) -> schemas.TimelineEventOut:
    return schemas.TimelineEventOut.model_validate(event)


@router.get("", response_model=List[schemas.TimelineEventOut])
def list_timeline_events(
    project_id: str = Query(..., description="Only events on this project are ever returned."),
    event_type: Optional[str] = None,
    related_entity_type: Optional[str] = None,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user, project_id, "view_project")
    query = db.query(models.TimelineEvent).filter(models.TimelineEvent.project_id == project_id)
    if event_type:
        query = query.filter(models.TimelineEvent.event_type == event_type)
    if related_entity_type:
        query = query.filter(models.TimelineEvent.related_entity_type == related_entity_type)
    events = query.order_by(models.TimelineEvent.created_at.desc()).limit(limit).all()
    return [serialize_event(e) for e in events]


@router.get("/{event_id}", response_model=schemas.TimelineEventOut)
def get_timeline_event(event_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(models.TimelineEvent).filter(models.TimelineEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Timeline event not found")
    require_project_access(db, current_user, event.project_id, "view_project")
    return serialize_event(event)


@router.post("", response_model=schemas.TimelineEventOut, status_code=201)
def create_timeline_event(payload: schemas.TimelineEventCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Manual timeline entries -- automatic ones are written by other
    Project Workspace routers via `log_timeline_event`, not here."""
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, payload.project_id, "manage_project")

    event = log_timeline_event(
        db,
        project_id=payload.project_id,
        event_type=payload.event_type,
        title=payload.title,
        description=payload.description,
        icon=payload.icon,
        related_entity_type=payload.related_entity_type,
        related_entity_id=payload.related_entity_id,
    )
    return serialize_event(event)


@router.delete("/{event_id}", status_code=204)
def delete_timeline_event(event_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(models.TimelineEvent).filter(models.TimelineEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Timeline event not found")
    require_project_access(db, current_user, event.project_id, "manage_project")
    db.delete(event)
    db.commit()
    return None
