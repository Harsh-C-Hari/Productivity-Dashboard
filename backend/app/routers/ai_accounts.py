"""
CRUD endpoints for AI Accounts (configured AI assistants: Claude, GPT,
Gemini, ...) -- the top-level entity most other AI Workspace tables
hang off of, analogous in role to `routers/subjects.py`'s Subject.

Filtering/search/sorting mirrors `projects.py`'s list endpoint shape.
Status updates and "mark used" go through the normal PATCH endpoint
(via `AIAccountUpdate`) rather than one-off endpoints, matching how
every other Project Workspace router handles partial updates -- except
for `last_used_at`, which gets a small dedicated endpoint since no
Create/Update field exists for "touch this record right now" anywhere
else in the app either.

Personal module: every AIAccount belongs to the current user via
`AIAccount.user_id`; Conversation/ProjectZip/AIHandoff/TokenTracker
inherit that ownership through `ai_account_id`.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..activity_log import log_activity
from ..auth_dependencies import get_current_user
from ..ownership_helpers import get_owned_or_404, owned_query

router = APIRouter(prefix="/api/ai-accounts", tags=["ai-workspace"])


def serialize_account(account: models.AIAccount) -> schemas.AIAccountOut:
    return schemas.AIAccountOut.model_validate(account)


def get_account_or_404(db: Session, account_id: str, user_id: str) -> models.AIAccount:
    return get_owned_or_404(db, models.AIAccount, account_id, user_id, "AI account not found")


def build_account_summary(db: Session, account: models.AIAccount) -> schemas.AIAccountSummary:
    conversations = db.query(models.Conversation).filter(models.Conversation.ai_account_id == account.id).all()
    active_conversations = [c for c in conversations if c.status == models.ConversationStatus.active]
    zip_count = db.query(models.ProjectZip).filter(models.ProjectZip.ai_account_id == account.id).count()
    handoff_count = db.query(models.AIHandoff).filter(models.AIHandoff.ai_account_id == account.id).count()
    token_rows = db.query(models.TokenTracker).filter(models.TokenTracker.ai_account_id == account.id).all()
    total_tokens = sum(t.total_tokens or 0 for t in token_rows)
    last_active_at = max(
        (c.last_message_at or c.started_at for c in conversations), default=None
    )
    return schemas.AIAccountSummary(
        account=serialize_account(account),
        conversation_count=len(conversations),
        active_conversation_count=len(active_conversations),
        zip_count=zip_count,
        handoff_count=handoff_count,
        total_tokens_used=total_tokens,
        last_active_at=last_active_at,
    )


@router.get("", response_model=List[schemas.AIAccountOut])
def list_ai_accounts(
    provider: Optional[models.AIProvider] = None,
    status: Optional[models.AIAccountStatus] = None,
    q: Optional[str] = None,
    sort_by: str = Query(default="updated_at", pattern="^(name|created_at|updated_at)$"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = owned_query(db, models.AIAccount, current_user.id)
    if provider:
        query = query.filter(models.AIAccount.provider == provider)
    if status:
        query = query.filter(models.AIAccount.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.AIAccount.name.ilike(like)) | (models.AIAccount.description.ilike(like))
        )

    sort_col = getattr(models.AIAccount, sort_by)
    query = query.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())

    if limit is not None:
        query = query.offset(offset).limit(limit)
    accounts = query.all()
    return [serialize_account(a) for a in accounts]


@router.get("/summary", response_model=List[schemas.AIAccountSummary])
def list_ai_account_summaries(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    accounts = owned_query(db, models.AIAccount, current_user.id).order_by(models.AIAccount.updated_at.desc()).all()
    return [build_account_summary(db, a) for a in accounts]


@router.get("/{account_id}", response_model=schemas.AIAccountOut)
def get_ai_account(account_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return serialize_account(get_account_or_404(db, account_id, current_user.id))


@router.get("/{account_id}/summary", response_model=schemas.AIAccountSummary)
def get_ai_account_summary(account_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    account = get_account_or_404(db, account_id, current_user.id)
    return build_account_summary(db, account)


@router.post("", response_model=schemas.AIAccountOut, status_code=201)
def create_ai_account(
    payload: schemas.AIAccountCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    account = models.AIAccount(**payload.model_dump(), user_id=current_user.id)
    db.add(account)
    db.commit()
    db.refresh(account)
    log_activity(db, f'Added AI account "{account.name}"', icon="bot", user_id=current_user.id)
    return serialize_account(account)


@router.patch("/{account_id}", response_model=schemas.AIAccountOut)
def update_ai_account(
    account_id: str,
    payload: schemas.AIAccountUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    account = get_account_or_404(db, account_id, current_user.id)
    status_changed = payload.status is not None and payload.status != account.status
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    if status_changed:
        log_activity(db, f'"{account.name}" status changed to {account.status.value}', icon="bot", user_id=current_user.id)
    return serialize_account(account)


@router.post("/{account_id}/touch", response_model=schemas.AIAccountOut)
def touch_ai_account(account_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Marks the account as just-used, bumping `updated_at` so
    "most recently used" sorting/default-selection UI can rely on it
    without needing a dedicated last_used_at column."""
    account = get_account_or_404(db, account_id, current_user.id)
    account.updated_at = utc_now()
    db.commit()
    db.refresh(account)
    return serialize_account(account)


@router.delete("/{account_id}", status_code=204)
def delete_ai_account(account_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    account = get_account_or_404(db, account_id, current_user.id)
    name = account.name
    db.delete(account)
    db.commit()
    log_activity(db, f'Removed AI account "{name}"', icon="trash-2", user_id=current_user.id)
    return None
