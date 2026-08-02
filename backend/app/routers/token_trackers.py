"""
CRUD + rollups for Token Trackers.

IMPORTANT SCOPE NOTE: Conversation 1 modeled `TokenTracker` as an
append-only *usage log* (one row per recorded usage event: input/
output/total tokens, estimated cost, model), the AI Workspace analogue
of `TimelineEvent`/`ActivityLog` -- see `models.py`'s docstring and
`AI_HANDOFF.md`. It does not have `enabled` / `limit_reached` /
`refresh_time` / `notify_enabled` / `notify_offset` / `status` columns
for a per-account "token limit countdown" settings object. Rather than
add columns not defined in Conversation 1's schema (out of scope --
"DO NOT redesign the database"), this router implements full CRUD and
analytics for the usage-log shape that actually exists. A settings-
style countdown/notify feature would need a small additive migration
(e.g. new columns on `AIAccount`, or a new `TokenTrackerSettings`
table) and should be scoped as its own follow-up task.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity

router = APIRouter(prefix="/api/token-trackers", tags=["ai-workspace"])


def serialize_tracker(tracker: models.TokenTracker) -> schemas.TokenTrackerOut:
    return schemas.TokenTrackerOut.model_validate(tracker)


def get_tracker_or_404(db: Session, tracker_id: str) -> models.TokenTracker:
    tracker = db.query(models.TokenTracker).filter(models.TokenTracker.id == tracker_id).first()
    if not tracker:
        raise HTTPException(status_code=404, detail="Token tracker entry not found")
    return tracker


@router.get("", response_model=List[schemas.TokenTrackerOut])
def list_token_trackers(
    ai_account_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    limit: Optional[int] = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(models.TokenTracker)
    if ai_account_id:
        query = query.filter(models.TokenTracker.ai_account_id == ai_account_id)
    if conversation_id:
        query = query.filter(models.TokenTracker.conversation_id == conversation_id)
    query = query.order_by(models.TokenTracker.recorded_at.desc())
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return [serialize_tracker(t) for t in query.all()]


@router.get("/summary", response_model=schemas.TokenUsageSummary)
def get_token_usage_summary(db: Session = Depends(get_db)):
    rows = db.query(models.TokenTracker).all()
    total_input = sum(r.input_tokens or 0 for r in rows)
    total_output = sum(r.output_tokens or 0 for r in rows)
    total_tokens = sum(r.total_tokens or 0 for r in rows)
    total_cost = sum(r.estimated_cost_usd or 0.0 for r in rows)

    by_account: dict = {}
    for r in rows:
        entry = by_account.setdefault(r.ai_account_id, {"total_tokens": 0, "total_estimated_cost_usd": 0.0})
        entry["total_tokens"] += r.total_tokens or 0
        entry["total_estimated_cost_usd"] += r.estimated_cost_usd or 0.0

    return schemas.TokenUsageSummary(
        total_input_tokens=total_input,
        total_output_tokens=total_output,
        total_tokens=total_tokens,
        total_estimated_cost_usd=round(total_cost, 4),
        by_account=[
            schemas.TokenTrackerAccountTotal(
                ai_account_id=account_id,
                total_tokens=vals["total_tokens"],
                total_estimated_cost_usd=round(vals["total_estimated_cost_usd"], 4),
            )
            for account_id, vals in by_account.items()
        ],
    )


@router.get("/accounts/{account_id}/total", response_model=schemas.TokenTrackerAccountTotal)
def get_account_token_total(account_id: str, db: Session = Depends(get_db)):
    rows = db.query(models.TokenTracker).filter(models.TokenTracker.ai_account_id == account_id).all()
    return schemas.TokenTrackerAccountTotal(
        ai_account_id=account_id,
        total_tokens=sum(r.total_tokens or 0 for r in rows),
        total_estimated_cost_usd=round(sum(r.estimated_cost_usd or 0.0 for r in rows), 4),
    )


@router.get("/{tracker_id}", response_model=schemas.TokenTrackerOut)
def get_token_tracker(tracker_id: str, db: Session = Depends(get_db)):
    return serialize_tracker(get_tracker_or_404(db, tracker_id))


@router.post("", response_model=schemas.TokenTrackerOut, status_code=201)
def record_token_usage(payload: schemas.TokenTrackerCreate, db: Session = Depends(get_db)):
    account = db.query(models.AIAccount).filter(models.AIAccount.id == payload.ai_account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="AI account not found")

    data = payload.model_dump()
    if not data.get("total_tokens"):
        data["total_tokens"] = (data.get("input_tokens") or 0) + (data.get("output_tokens") or 0)
    tracker = models.TokenTracker(**data)
    db.add(tracker)
    db.commit()
    db.refresh(tracker)
    return serialize_tracker(tracker)


@router.patch("/{tracker_id}", response_model=schemas.TokenTrackerOut)
def update_token_tracker(tracker_id: str, payload: schemas.TokenTrackerUpdate, db: Session = Depends(get_db)):
    tracker = get_tracker_or_404(db, tracker_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tracker, field, value)
    db.commit()
    db.refresh(tracker)
    return serialize_tracker(tracker)


@router.delete("/{tracker_id}", status_code=204)
def delete_token_tracker(tracker_id: str, db: Session = Depends(get_db)):
    tracker = get_tracker_or_404(db, tracker_id)
    db.delete(tracker)
    db.commit()
    return None


# ---- Best-effort activity events for a per-account limit/refresh
# lifecycle. There's no `status`/`limit_reached`/`refresh_time` column
# to persist against (see module docstring), so these only write to
# ActivityLog -- they satisfy the "Token Limit Reached"/"Token
# Refreshed" activity-logging requirement without inventing new
# database state. ----

@router.post("/accounts/{account_id}/mark-limited", status_code=204)
def mark_account_token_limited(account_id: str, db: Session = Depends(get_db)):
    account = db.query(models.AIAccount).filter(models.AIAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="AI account not found")
    log_activity(db, f'Token limit reached for "{account.name}"', icon="alert-triangle")
    return None


@router.post("/accounts/{account_id}/mark-refreshed", status_code=204)
def mark_account_token_refreshed(account_id: str, db: Session = Depends(get_db)):
    account = db.query(models.AIAccount).filter(models.AIAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="AI account not found")
    log_activity(db, f'Token limit refreshed for "{account.name}"', icon="rotate-ccw")
    return None
