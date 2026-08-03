"""
CRUD endpoints for Conversations (a chat/session with an AI account,
optionally scoped to a project). Mirrors `assignments.py`'s shape:
FK to a parent (ai_account), optional FK to a project, status enum,
search/filter/sort/pagination, plus a `clear_project` convenience flag
matching `ConversationUpdate`.

Access rule (data-isolation fix): a Conversation's `ai_account_id`
always points at a personal AIAccount (see ai_accounts.py) -- that
account's owner is who can see/manage the conversation. When the
conversation is also attached to a project (`project_id` set), project
members get read access too via `require_project_access`, per the
"Project Content inherits Project permissions" rule -- but management
(create/update/delete) and personal (no project_id) conversations stay
restricted to the AIAccount owner, since Project Collaboration only
exposes Project Content, and an AIAccount is not itself project-owned.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event, get_accessible_project_ids
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/conversations", tags=["ai-workspace"])


def serialize_conversation(conversation: models.Conversation) -> schemas.ConversationOut:
    return schemas.ConversationOut.model_validate(conversation)


def _get_owned_account(db: Session, account_id: str, user_id: str) -> models.AIAccount:
    account = db.query(models.AIAccount).filter(
        models.AIAccount.id == account_id, models.AIAccount.user_id == user_id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="AI account not found")
    return account


def get_accessible_conversation(db: Session, current_user: models.User, conversation_id: str) -> models.Conversation:
    """404s unless the conversation is owned via its AIAccount, or
    (read-only cases handled by the caller) attached to a project the
    user can access."""
    conversation = (
        db.query(models.Conversation)
        .join(models.AIAccount, models.Conversation.ai_account_id == models.AIAccount.id)
        .filter(models.Conversation.id == conversation_id, models.AIAccount.user_id == current_user.id)
        .first()
    )
    if conversation:
        return conversation
    # Not the owner -- allow read/manage only if it's project content the
    # user has access to.
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if conversation and conversation.project_id:
        require_project_access(db, current_user, conversation.project_id, "view_ai_workspace")
        return conversation
    raise HTTPException(status_code=404, detail="Conversation not found")


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
        query = db.query(models.Conversation).filter(models.Conversation.project_id == project_id)
    else:
        # No explicit project filter: everything the user owns (via their
        # own AIAccounts) plus conversations attached to any project they
        # can access.
        accessible_project_ids = get_accessible_project_ids(db, current_user.id)
        owned_account_ids = [
            a.id for a in db.query(models.AIAccount).filter(models.AIAccount.user_id == current_user.id).all()
        ]
        from sqlalchemy import or_
        query = db.query(models.Conversation).filter(
            or_(
                models.Conversation.ai_account_id.in_(owned_account_ids),
                models.Conversation.project_id.in_(accessible_project_ids),
            )
        )

    if ai_account_id:
        query = query.filter(models.Conversation.ai_account_id == ai_account_id)
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
    conversation = get_accessible_conversation(db, current_user, conversation_id)
    return serialize_conversation(conversation)


@router.get("/{conversation_id}/summary", response_model=schemas.ConversationSummary)
def get_conversation_summary(conversation_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = get_accessible_conversation(db, current_user, conversation_id)
    return build_conversation_summary(db, conversation)


@router.post("", response_model=schemas.ConversationOut, status_code=201)
def create_conversation(payload: schemas.ConversationCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = _get_owned_account(db, payload.ai_account_id, current_user.id)
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

    log_activity(db, f'Started conversation "{conversation.title}" with {account.name}', icon="message-square", user_id=current_user.id)
    if conversation.project_id:
        log_timeline_event(
            db, conversation.project_id, "ai_conversation_started", f'Conversation "{conversation.title}" started',
            related_entity_type="conversation", related_entity_id=conversation.id, icon="message-square",
        )
    return serialize_conversation(conversation)


@router.patch("/{conversation_id}", response_model=schemas.ConversationOut)
def update_conversation(conversation_id: str, payload: schemas.ConversationUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = get_accessible_conversation(db, current_user, conversation_id)
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
        log_activity(db, f'Finished conversation "{conversation.title}"', icon="check-circle", user_id=current_user.id)
        if conversation.project_id:
            log_timeline_event(
                db, conversation.project_id, "ai_conversation_finished",
                f'Conversation "{conversation.title}" finished',
                related_entity_type="conversation", related_entity_id=conversation.id, icon="check-circle",
            )
    return serialize_conversation(conversation)


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = get_accessible_conversation(db, current_user, conversation_id)
    if conversation.project_id:
        require_project_access(db, current_user, conversation.project_id, "manage_ai_workspace")
    title = conversation.title
    db.delete(conversation)
    db.commit()
    log_activity(db, f'Deleted conversation "{title}"', icon="trash-2", user_id=current_user.id)
    return None
