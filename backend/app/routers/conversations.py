"""
CRUD endpoints for Conversations (a chat/session with an AI account,
optionally scoped to a project). Mirrors `assignments.py`'s shape:
FK to a parent (ai_account), optional FK to a project, status enum,
search/filter/sort/pagination, plus a `clear_project` convenience flag
matching `ConversationUpdate`.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/conversations", tags=["ai-workspace"])


def serialize_conversation(conversation: models.Conversation) -> schemas.ConversationOut:
    return schemas.ConversationOut.model_validate(conversation)


def get_conversation_or_404(db: Session, conversation_id: str) -> models.Conversation:
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def build_conversation_summary(db: Session, conversation: models.Conversation) -> schemas.ConversationSummary:
    zip_count = db.query(models.ProjectZip).filter(models.ProjectZip.conversation_id == conversation.id).count()
    handoff_count = db.query(models.AIHandoff).filter(models.AIHandoff.conversation_id == conversation.id).count()
    token_rows = db.query(models.TokenTracker).filter(models.TokenTracker.conversation_id == conversation.id).all()
    total_tokens = sum(t.total_tokens or 0 for t in token_rows)
    return schemas.ConversationSummary(
        conversation=serialize_conversation(conversation),
        zip_count=zip_count,
        handoff_count=handoff_count,
        total_tokens_used=total_tokens,
    )


@router.get("", response_model=List[schemas.ConversationOut])
def list_conversations(
    ai_account_id: Optional[str] = None,
    project_id: Optional[str] = None,
    status: Optional[models.ConversationStatus] = None,
    q: Optional[str] = None,
    sort_by: str = Query(default="started_at", pattern="^(title|started_at|last_message_at|created_at|updated_at)$"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if project_id:
        require_project_access(db, current_user, project_id, "view_ai_workspace")
    query = db.query(models.Conversation)
    if ai_account_id:
        query = query.filter(models.Conversation.ai_account_id == ai_account_id)
    if project_id:
        query = query.filter(models.Conversation.project_id == project_id)
    if status:
        query = query.filter(models.Conversation.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.Conversation.title.ilike(like)) | (models.Conversation.summary.ilike(like))
        )

    sort_col = getattr(models.Conversation, sort_by)
    query = query.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())

    if limit is not None:
        query = query.offset(offset).limit(limit)
    return [serialize_conversation(c) for c in query.all()]


@router.get("/{conversation_id}", response_model=schemas.ConversationOut)
def get_conversation(conversation_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = get_conversation_or_404(db, conversation_id)
    if conversation.project_id:
        require_project_access(db, current_user, conversation.project_id, "view_ai_workspace")
    return serialize_conversation(conversation)


@router.get("/{conversation_id}/summary", response_model=schemas.ConversationSummary)
def get_conversation_summary(conversation_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = get_conversation_or_404(db, conversation_id)
    if conversation.project_id:
        require_project_access(db, current_user, conversation.project_id, "view_ai_workspace")
    return build_conversation_summary(db, conversation)


@router.post("", response_model=schemas.ConversationOut, status_code=201)
def create_conversation(payload: schemas.ConversationCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = db.query(models.AIAccount).filter(models.AIAccount.id == payload.ai_account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="AI account not found")
    if payload.project_id:
        project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        require_project_access(db, current_user, payload.project_id, "manage_ai_workspace")

    data = payload.model_dump()
    if data.get("started_at") is None:
        data.pop("started_at", None)
    conversation = models.Conversation(**data)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    log_activity(db, f'Started conversation "{conversation.title}" with {account.name}', icon="message-square")
    if conversation.project_id:
        log_timeline_event(
            db, conversation.project_id, "ai_conversation_started", f'Conversation "{conversation.title}" started',
            related_entity_type="conversation", related_entity_id=conversation.id, icon="message-square",
        )
    return serialize_conversation(conversation)


@router.patch("/{conversation_id}", response_model=schemas.ConversationOut)
def update_conversation(conversation_id: str, payload: schemas.ConversationUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = get_conversation_or_404(db, conversation_id)
    if conversation.project_id:
        require_project_access(db, current_user, conversation.project_id, "manage_ai_workspace")
    data = payload.model_dump(exclude_unset=True)
    clear_project = data.pop("clear_project", False)

    status_becoming_completed = (
        data.get("status") == models.ConversationStatus.completed
        and conversation.status != models.ConversationStatus.completed
    )

    if data.get("project_id"):
        project = db.query(models.Project).filter(models.Project.id == data["project_id"]).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        require_project_access(db, current_user, data["project_id"], "manage_ai_workspace")

    for field, value in data.items():
        setattr(conversation, field, value)
    if clear_project:
        conversation.project_id = None

    db.commit()
    db.refresh(conversation)

    if status_becoming_completed:
        log_activity(db, f'Finished conversation "{conversation.title}"', icon="check-circle")
        if conversation.project_id:
            log_timeline_event(
                db, conversation.project_id, "ai_conversation_finished",
                f'Conversation "{conversation.title}" finished',
                related_entity_type="conversation", related_entity_id=conversation.id, icon="check-circle",
            )
    return serialize_conversation(conversation)


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = get_conversation_or_404(db, conversation_id)
    if conversation.project_id:
        require_project_access(db, current_user, conversation.project_id, "manage_ai_workspace")
    title = conversation.title
    db.delete(conversation)
    db.commit()
    log_activity(db, f'Deleted conversation "{title}"', icon="trash-2")
    return None
