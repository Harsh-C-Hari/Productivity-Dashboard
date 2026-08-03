"""
CRUD endpoints for AI Handoffs -- structured session handoff notes, the
database-backed analogue of this repo's own AI_HANDOFF.md. Search
covers completed_work/remaining_work/next_objective; "latest handoff
lookup" is scoped by whichever of project/ai_account/conversation is
provided, mirroring how `token_trackers.py`'s totals endpoint scopes by
account.

Access rule (data-isolation fix): a handoff can be scoped to a project,
an ai_account, and/or a conversation (all optional on the model). Access
follows whichever of those is set, in that order of precedence -- a
project-attached handoff is Project Content (project members can see
it); an ai_account/conversation-only handoff is personal (only the
owning user can see it, via the same AIAccount ownership chain
`conversations.py` uses). A handoff scoped to none of the three would be
unownable and is now rejected at creation time.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event, get_accessible_project_ids
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


def _owned_ai_account_ids(db: Session, user_id: str) -> List[str]:
    return [a.id for a in db.query(models.AIAccount).filter(models.AIAccount.user_id == user_id).all()]


def _owned_conversation_ids(db: Session, user_id: str) -> List[str]:
    return [
        c.id
        for c in db.query(models.Conversation)
        .join(models.AIAccount, models.Conversation.ai_account_id == models.AIAccount.id)
        .filter(models.AIAccount.user_id == user_id)
        .all()
    ]


def check_handoff_access(db: Session, current_user: models.User, handoff: models.AIHandoff, permission: str) -> None:
    if handoff.project_id:
        require_project_access(db, current_user, handoff.project_id, permission)
        return
    if handoff.ai_account_id and handoff.ai_account_id in _owned_ai_account_ids(db, current_user.id):
        return
    if handoff.conversation_id and handoff.conversation_id in _owned_conversation_ids(db, current_user.id):
        return
    raise HTTPException(status_code=404, detail="Handoff not found")


def get_handoff_or_404(db: Session, current_user: models.User, handoff_id: str, permission: str = "view_ai_workspace") -> models.AIHandoff:
    handoff = db.query(models.AIHandoff).filter(models.AIHandoff.id == handoff_id).first()
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff not found")
    check_handoff_access(db, current_user, handoff, permission)
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
        query = db.query(models.AIHandoff).filter(models.AIHandoff.project_id == project_id)
    else:
        accessible_project_ids = get_accessible_project_ids(db, current_user.id)
        owned_account_ids = _owned_ai_account_ids(db, current_user.id)
        owned_conversation_ids = _owned_conversation_ids(db, current_user.id)
        query = db.query(models.AIHandoff).filter(
            or_(
                models.AIHandoff.project_id.in_(accessible_project_ids),
                models.AIHandoff.ai_account_id.in_(owned_account_ids),
                models.AIHandoff.conversation_id.in_(owned_conversation_ids),
            )
        )
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
    elif ai_account_id and ai_account_id not in _owned_ai_account_ids(db, current_user.id):
        raise HTTPException(status_code=404, detail="AI account not found")
    elif conversation_id and conversation_id not in _owned_conversation_ids(db, current_user.id):
        raise HTTPException(status_code=404, detail="Conversation not found")
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
    return serialize_handoff(get_handoff_or_404(db, current_user, handoff_id))


@router.post("", response_model=schemas.AIHandoffOut, status_code=201)
def create_ai_handoff(payload: schemas.AIHandoffCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not any([payload.project_id, payload.ai_account_id, payload.conversation_id]):
        raise HTTPException(
            status_code=400, detail="A handoff must be attached to a project, AI account, or conversation"
        )
    if payload.project_id:
        require_project_access(db, current_user, payload.project_id, "manage_ai_workspace")
    elif payload.ai_account_id and payload.ai_account_id not in _owned_ai_account_ids(db, current_user.id):
        raise HTTPException(status_code=404, detail="AI account not found")
    elif payload.conversation_id and payload.conversation_id not in _owned_conversation_ids(db, current_user.id):
        raise HTTPException(status_code=404, detail="Conversation not found")

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

    log_activity(db, "Added AI handoff notes", icon="clipboard-list", user_id=current_user.id)
    if handoff.project_id:
        log_timeline_event(
            db, handoff.project_id, "handoff_added", "Handoff notes added",
            related_entity_type="ai_handoff", related_entity_id=handoff.id, icon="clipboard-list",
        )
    return serialize_handoff(handoff)


@router.patch("/{handoff_id}", response_model=schemas.AIHandoffOut)
def update_ai_handoff(handoff_id: str, payload: schemas.AIHandoffUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    handoff = get_handoff_or_404(db, current_user, handoff_id, permission="manage_ai_workspace")
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
    handoff = get_handoff_or_404(db, current_user, handoff_id, permission="manage_ai_workspace")
    db.delete(handoff)
    db.commit()
    log_activity(db, "Deleted an AI handoff", icon="trash-2", user_id=current_user.id)
    return None
