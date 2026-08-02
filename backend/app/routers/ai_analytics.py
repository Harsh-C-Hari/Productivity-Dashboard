"""
AI Workspace analytics: the top-level `AIWorkspaceSummary` aggregate
(same role as `analytics.get_workspace_analytics` for Project
Workspace) plus a breakdown endpoint covering every metric the task
brief asked for (conversations per project/provider, prompt
categories, ZIP upload count, knowledge articles, provider usage,
conversation status, recent activity). Computed on the fly from the
child tables, same philosophy as `routers/analytics.py`.
"""
from typing import Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/ai-analytics", tags=["ai-workspace"])


@router.get("/summary", response_model=schemas.AIWorkspaceSummary)
def get_ai_workspace_summary(db: Session = Depends(get_db)):
    accounts = db.query(models.AIAccount).all()
    active_accounts = [a for a in accounts if a.status == models.AIAccountStatus.active]

    conversations = db.query(models.Conversation).all()
    active_conversations = [c for c in conversations if c.status == models.ConversationStatus.active]

    prompt_count = db.query(models.PromptTemplate).count()
    zip_count = db.query(models.ProjectZip).count()
    handoff_count = db.query(models.AIHandoff).count()
    article_count = db.query(models.KnowledgeArticle).count()

    token_rows = db.query(models.TokenTracker).all()
    total_input = sum(t.input_tokens or 0 for t in token_rows)
    total_output = sum(t.output_tokens or 0 for t in token_rows)
    total_tokens = sum(t.total_tokens or 0 for t in token_rows)
    total_cost = sum(t.estimated_cost_usd or 0.0 for t in token_rows)

    by_account: Dict[str, Dict[str, float]] = {}
    for t in token_rows:
        entry = by_account.setdefault(t.ai_account_id, {"total_tokens": 0, "total_estimated_cost_usd": 0.0})
        entry["total_tokens"] += t.total_tokens or 0
        entry["total_estimated_cost_usd"] += t.estimated_cost_usd or 0.0

    token_usage = schemas.TokenUsageSummary(
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

    recent_handoffs = (
        db.query(models.AIHandoff).order_by(models.AIHandoff.created_at.desc()).limit(5).all()
    )
    recent_conversations = (
        db.query(models.Conversation).order_by(models.Conversation.updated_at.desc()).limit(5).all()
    )

    # Import here (not at module top) to avoid a circular import with
    # ai_handoffs.py's serializer, mirroring how projects.py lazily
    # imports sibling serializers inside function bodies.
    from .ai_handoffs import serialize_handoff
    from .conversations import serialize_conversation

    return schemas.AIWorkspaceSummary(
        total_accounts=len(accounts),
        active_accounts=len(active_accounts),
        total_conversations=len(conversations),
        active_conversations=len(active_conversations),
        total_prompt_templates=prompt_count,
        total_zips=zip_count,
        total_handoffs=handoff_count,
        total_knowledge_articles=article_count,
        token_usage=token_usage,
        recent_handoffs=[serialize_handoff(h) for h in recent_handoffs],
        recent_conversations=[serialize_conversation(c) for c in recent_conversations],
    )


@router.get("/conversations-per-project")
def conversations_per_project(db: Session = Depends(get_db)):
    conversations = db.query(models.Conversation).filter(models.Conversation.project_id.isnot(None)).all()
    projects = {p.id: p.name for p in db.query(models.Project).all()}
    counts: Dict[str, int] = {}
    for c in conversations:
        counts[c.project_id] = counts.get(c.project_id, 0) + 1
    return [
        {"project_id": pid, "project_name": projects.get(pid, "Unknown"), "conversation_count": count}
        for pid, count in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    ]


@router.get("/conversations-per-provider")
def conversations_per_provider(db: Session = Depends(get_db)):
    conversations = db.query(models.Conversation).all()
    account_provider = {a.id: a.provider for a in db.query(models.AIAccount).all()}
    counts: Dict[str, int] = {p.value: 0 for p in models.AIProvider}
    for c in conversations:
        provider = account_provider.get(c.ai_account_id)
        if provider:
            counts[provider.value] = counts.get(provider.value, 0) + 1
    return [{"provider": provider, "conversation_count": count} for provider, count in counts.items()]


@router.get("/prompt-categories")
def prompt_categories(db: Session = Depends(get_db)):
    prompts = db.query(models.PromptTemplate).all()
    counts: Dict[str, int] = {}
    for p in prompts:
        counts[p.category] = counts.get(p.category, 0) + 1
    return [
        {"category": category, "count": count}
        for category, count in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    ]


@router.get("/zip-upload-count")
def zip_upload_count(db: Session = Depends(get_db)):
    zips = db.query(models.ProjectZip).all()
    projects = {p.id: p.name for p in db.query(models.Project).all()}
    counts: Dict[str, int] = {}
    for z in zips:
        counts[z.project_id] = counts.get(z.project_id, 0) + 1
    return {
        "total": len(zips),
        "by_project": [
            {"project_id": pid, "project_name": projects.get(pid, "Unknown"), "zip_count": count}
            for pid, count in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
        ],
    }


@router.get("/knowledge-articles")
def knowledge_article_breakdown(db: Session = Depends(get_db)):
    articles = db.query(models.KnowledgeArticle).all()
    by_category: Dict[str, int] = {}
    by_source: Dict[str, int] = {s.value: 0 for s in models.KnowledgeSource}
    for a in articles:
        by_category[a.category] = by_category.get(a.category, 0) + 1
        by_source[a.source.value] = by_source.get(a.source.value, 0) + 1
    return {
        "total": len(articles),
        "by_category": [{"category": c, "count": n} for c, n in by_category.items()],
        "by_source": [{"source": s, "count": n} for s, n in by_source.items()],
    }


@router.get("/provider-usage")
def provider_usage(db: Session = Depends(get_db)):
    token_rows = db.query(models.TokenTracker).all()
    account_provider = {a.id: a.provider for a in db.query(models.AIAccount).all()}
    totals: Dict[str, Dict[str, float]] = {p.value: {"total_tokens": 0, "total_estimated_cost_usd": 0.0} for p in models.AIProvider}
    for t in token_rows:
        provider = account_provider.get(t.ai_account_id)
        if not provider:
            continue
        totals[provider.value]["total_tokens"] += t.total_tokens or 0
        totals[provider.value]["total_estimated_cost_usd"] += t.estimated_cost_usd or 0.0
    return [
        {
            "provider": provider,
            "total_tokens": vals["total_tokens"],
            "total_estimated_cost_usd": round(vals["total_estimated_cost_usd"], 4),
        }
        for provider, vals in totals.items()
    ]


@router.get("/conversation-status")
def conversation_status_breakdown(db: Session = Depends(get_db)):
    conversations = db.query(models.Conversation).all()
    counts: Dict[str, int] = {s.value: 0 for s in models.ConversationStatus}
    for c in conversations:
        counts[c.status.value] = counts.get(c.status.value, 0) + 1
    return [{"status": status, "count": count} for status, count in counts.items()]


@router.get("/token-limits-reached")
def token_limits_reached(db: Session = Depends(get_db)):
    """Counts 'Token limit reached' activity log events per account,
    since no persisted limit-reached flag exists on TokenTracker/
    AIAccount (see routers/token_trackers.py's module docstring)."""
    events = (
        db.query(models.ActivityLog)
        .filter(models.ActivityLog.message.ilike("Token limit reached for%"))
        .all()
    )
    return {"count": len(events), "events": [{"message": e.message, "created_at": e.created_at} for e in events]}
