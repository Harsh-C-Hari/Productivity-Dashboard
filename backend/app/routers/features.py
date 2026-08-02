"""
CRUD endpoints for Features (planned/in-progress units of work,
optionally grouped under a phase). Every response passes through
`serialize_feature`, which computes urgency via the existing Smart
Urgency Engine -- Feature has no deadline column, so this always takes
the "no deadline, base on remaining effort" branch of
`urgency.compute_urgency`, exactly as documented in `models.Feature`.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..urgency import compute_urgency
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/features", tags=["project-workspace"])


def serialize_feature(feature: models.Feature, phase: Optional[models.ProjectPhase] = None) -> schemas.FeatureOut:
    urgency = compute_urgency(
        deadline=None,
        estimated_effort_hours=feature.estimated_effort_hours or 0,
        progress=feature.progress or 0,
        status=feature.status.value if hasattr(feature.status, "value") else feature.status,
    )
    out = schemas.FeatureOut.model_validate(feature)
    out.urgency = urgency
    if phase:
        out.phase_title = phase.title
    return out


def get_feature_or_404(db: Session, feature_id: str) -> models.Feature:
    feature = db.query(models.Feature).filter(models.Feature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    return feature


def _phase_map(db: Session) -> dict:
    return {p.id: p for p in db.query(models.ProjectPhase).all()}


@router.get("", response_model=List[schemas.FeatureOut])
def list_features(
    project_id: str = Query(..., description="Only features on this project are ever returned."),
    phase_id: Optional[str] = None,
    status: Optional[models.FeatureStatus] = None,
    priority: Optional[models.Priority] = None,
    q: Optional[str] = None,
    sort_by: str = Query(default="created_at", pattern="^(created_at|updated_at|priority|progress|title)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user, project_id, "view_tasks")
    query = db.query(models.Feature).filter(models.Feature.project_id == project_id)
    if phase_id:
        query = query.filter(models.Feature.phase_id == phase_id)
    if status:
        query = query.filter(models.Feature.status == status)
    if priority:
        query = query.filter(models.Feature.priority == priority)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(models.Feature.title.ilike(like), models.Feature.description.ilike(like)))

    sort_column = getattr(models.Feature, sort_by)
    sort_column = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    query = query.order_by(sort_column)

    if limit is not None:
        query = query.offset(offset).limit(limit)

    features = query.all()
    phases = _phase_map(db)
    return [serialize_feature(f, phases.get(f.phase_id)) for f in features]


@router.get("/{feature_id}", response_model=schemas.FeatureOut)
def get_feature(feature_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    feature = get_feature_or_404(db, feature_id)
    require_project_access(db, current_user, feature.project_id, "view_tasks")
    phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == feature.phase_id).first() if feature.phase_id else None
    return serialize_feature(feature, phase)


@router.post("", response_model=schemas.FeatureOut, status_code=201)
def create_feature(payload: schemas.FeatureCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, payload.project_id, "manage_tasks")
    phase = None
    if payload.phase_id:
        phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == payload.phase_id).first()
        if not phase:
            raise HTTPException(status_code=404, detail="Phase not found")

    feature = models.Feature(**payload.model_dump())
    db.add(feature)
    db.commit()
    db.refresh(feature)
    log_activity(db, f'Added feature "{feature.title}" to {project.name}', icon="sparkles")
    log_timeline_event(
        db, project.id, "feature_created", f'Feature "{feature.title}" added',
        related_entity_type="feature", related_entity_id=feature.id, icon="sparkles",
    )
    return serialize_feature(feature, phase)


@router.patch("/{feature_id}", response_model=schemas.FeatureOut)
def update_feature(feature_id: str, payload: schemas.FeatureUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    feature = get_feature_or_404(db, feature_id)
    require_project_access(db, current_user, feature.project_id, "manage_tasks")
    was_done = feature.status == models.FeatureStatus.done

    data = payload.model_dump(exclude_unset=True)
    clear_phase = data.pop("clear_phase", False)

    if data.get("phase_id"):
        phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == data["phase_id"]).first()
        if not phase:
            raise HTTPException(status_code=404, detail="Phase not found")

    for field, value in data.items():
        setattr(feature, field, value)
    if clear_phase:
        feature.phase_id = None

    if feature.status == models.FeatureStatus.done:
        feature.progress = 100
    if feature.progress == 100 and feature.status != models.FeatureStatus.done:
        feature.status = models.FeatureStatus.done

    feature.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(feature)

    phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == feature.phase_id).first() if feature.phase_id else None

    if feature.status == models.FeatureStatus.done and not was_done:
        log_activity(db, f'Completed feature "{feature.title}"', icon="check-circle")
        log_timeline_event(
            db, feature.project_id, "feature_completed", f'Feature "{feature.title}" done',
            related_entity_type="feature", related_entity_id=feature.id, icon="check-circle",
        )
    else:
        log_activity(db, f'Updated feature "{feature.title}"', icon="pencil")

    return serialize_feature(feature, phase)


@router.delete("/{feature_id}", status_code=204)
def delete_feature(feature_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Un-groups (does not delete) any todos/bugs tied to this feature --
    see `models.Feature` docstring."""
    feature = get_feature_or_404(db, feature_id)
    require_project_access(db, current_user, feature.project_id, "manage_tasks")
    title = feature.title
    project_id = feature.project_id
    db.delete(feature)
    db.commit()
    log_activity(db, f'Deleted feature "{title}"', icon="trash-2")
    log_timeline_event(db, project_id, "feature_deleted", f'Feature "{title}" deleted', icon="trash-2")
    return None
