"""
CRUD endpoints for AI Handoffs -- structured session handoff notes, the
database-backed analogue of this repo's own AI_HANDOFF.md. Search
covers completed_work/remaining_work/next_objective; "latest handoff
lookup" is scoped by whichever of project/ai_account/conversation is
provided, mirroring how `token_trackers.py`'s totals endpoint scopes by
account.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/ai-handoffs", tags=["ai-workspace"])


def serialize_handoff(handoff: models.AIHandoff) -> schemas.AIHandoffOut:
    return schemas.AIHandoffOut.model_validate(
        {
            "id": handoff.id,
            "project_id": handoff.project_id,
            "ai_account_id": handoff.ai_account_id,
            "conversation_id": handoff.conversation_id,
            "completed_work": handoff.completed_work,
            "created_files": json.loads(handoff.created_files or "[]"),
            "modified_files": json.loads(handoff.modified_files or "[]"),
            "remaining_work": handoff.remaining_work,
            "known_issues": handoff.known_issues,
            "next_objective": handoff.next_objective,
            "created_at": handoff.created_at,
        }
    )


def get_handoff_or_404(db: Session, handoff_id: str) -> models.AIHandoff:
    handoff = db.query(models.AIHandoff).filter(models.AIHandoff.id == handoff_id).first()
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff not found")
    return handoff


@router.get("", response_model=List[schemas.AIHandoffOut])
def list_ai_handoffs(
    project_id: Optional[str] = None,
    ai_account_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    q: Optional[str] = None,
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if project_id:
        require_project_access(db, current_user, project_id, "view_ai_workspace")
    query = db.query(models.AIHandoff)
    if project_id:
        query = query.filter(models.AIHandoff.project_id == project_id)
    if ai_account_id:
        query = query.filter(models.AIHandoff.ai_account_id == ai_account_id)
    if conversation_id:
        query = query.filter(models.AIHandoff.conversation_id == conversation_id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.AIHandoff.completed_work.ilike(like))
            | (models.AIHandoff.remaining_work.ilike(like))
            | (models.AIHandoff.next_objective.ilike(like))
            | (models.AIHandoff.known_issues.ilike(like))
        )
    query = query.order_by(models.AIHandoff.created_at.desc())
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return [serialize_handoff(h) for h in query.all()]


@router.get("/latest", response_model=schemas.AIHandoffOut)
def get_latest_handoff(
    project_id: Optional[str] = None,
    ai_account_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if project_id:
        require_project_access(db, current_user, project_id, "view_ai_workspace")
    if not any([project_id, ai_account_id, conversation_id]):
        raise HTTPException(
            status_code=400, detail="Provide at least one of project_id, ai_account_id, conversation_id"
        )
    query = db.query(models.AIHandoff)
    if project_id:
        query = query.filter(models.AIHandoff.project_id == project_id)
    if ai_account_id:
        query = query.filter(models.AIHandoff.ai_account_id == ai_account_id)
    if conversation_id:
        query = query.filter(models.AIHandoff.conversation_id == conversation_id)
    handoff = query.order_by(models.AIHandoff.created_at.desc()).first()
    if not handoff:
        raise HTTPException(status_code=404, detail="No handoffs found for the given scope")
    return serialize_handoff(handoff)


@router.get("/{handoff_id}", response_model=schemas.AIHandoffOut)
def get_ai_handoff(handoff_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    handoff = get_handoff_or_404(db, handoff_id)
    if handoff.project_id:
        require_project_access(db, current_user, handoff.project_id, "view_ai_workspace")
    return serialize_handoff(handoff)


@router.post("", response_model=schemas.AIHandoffOut, status_code=201)
def create_ai_handoff(payload: schemas.AIHandoffCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.project_id:
        require_project_access(db, current_user, payload.project_id, "manage_ai_workspace")
    data = payload.model_dump()
    created_files = data.pop("created_files", [])
    modified_files = data.pop("modified_files", [])
    handoff = models.AIHandoff(
        **data,
        created_files=json.dumps(created_files),
        modified_files=json.dumps(modified_files),
    )
    db.add(handoff)
    db.commit()
    db.refresh(handoff)

    log_activity(db, "Added AI handoff notes", icon="clipboard-list")
    if handoff.project_id:
        log_timeline_event(
            db, handoff.project_id, "handoff_added", "Handoff notes added",
            related_entity_type="ai_handoff", related_entity_id=handoff.id, icon="clipboard-list",
        )
    return serialize_handoff(handoff)


@router.patch("/{handoff_id}", response_model=schemas.AIHandoffOut)
def update_ai_handoff(handoff_id: str, payload: schemas.AIHandoffUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    handoff = get_handoff_or_404(db, handoff_id)
    if handoff.project_id:
        require_project_access(db, current_user, handoff.project_id, "manage_ai_workspace")
    data = payload.model_dump(exclude_unset=True)
    if "created_files" in data:
        data["created_files"] = json.dumps(data["created_files"] or [])
    if "modified_files" in data:
        data["modified_files"] = json.dumps(data["modified_files"] or [])
    for field, value in data.items():
        setattr(handoff, field, value)
    db.commit()
    db.refresh(handoff)
    return serialize_handoff(handoff)


@router.delete("/{handoff_id}", status_code=204)
def delete_ai_handoff(handoff_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    handoff = get_handoff_or_404(db, handoff_id)
    if handoff.project_id:
        require_project_access(db, current_user, handoff.project_id, "manage_ai_workspace")
    db.delete(handoff)
    db.commit()
    log_activity(db, "Deleted an AI handoff", icon="trash-2")
    return None
