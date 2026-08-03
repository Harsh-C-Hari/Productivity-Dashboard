"""
Global Search: a single `/api/search?q=` endpoint spanning Tasks, Study
Hub (subjects/assignments/notes/resources), Project Workspace
(projects/todos/features/bugs/milestones/documents), and AI Workspace
(AI accounts/conversations/prompt templates/knowledge articles/project
zips/AI handoffs).

This intentionally does NOT reimplement filtering logic -- it runs the
same `ilike` queries the existing scoped search endpoints
(`study_hub.search_study_hub`, `projects.search_projects`) already use,
and flattens everything into one small, ranked, navigable list for a
command-palette-style UI. The scoped endpoints are left untouched and
still power their own module's in-page search.

Data-isolation fix: every result type here is scoped to what the
current user can actually see -- Task/AIAccount/PromptTemplate by
`user_id`, Subject/Assignment/Note by their owning Subject's
`user_id`, and Conversation/KnowledgeArticle/AIHandoff by (owned via
their AI Workspace parent) OR (attached to an accessible project). The
previous version's comment claiming these were "personal/global data"
visible to everyone was the leak this whole task exists to fix.
"""
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth_dependencies import get_current_user
from ..project_helpers import get_accessible_project_ids

router = APIRouter(prefix="/api/search", tags=["search"])

MAX_PER_TYPE = 5


@router.get("", response_model=schemas.GlobalSearchResult)
def global_search(
    q: str = Query(min_length=1),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    like = f"%{q}%"
    results: List[schemas.GlobalSearchItem] = []
    accessible_project_ids = get_accessible_project_ids(db, current_user.id)
    owned_subject_ids = [
        s.id for s in db.query(models.Subject).filter(models.Subject.user_id == current_user.id).all()
    ]
    owned_account_ids = [
        a.id for a in db.query(models.AIAccount).filter(models.AIAccount.user_id == current_user.id).all()
    ]
    owned_conversation_ids = [
        c.id
        for c in db.query(models.Conversation)
        .filter(models.Conversation.ai_account_id.in_(owned_account_ids))
        .all()
    ]

    tasks = (
        db.query(models.Task)
        .filter(
            models.Task.user_id == current_user.id,
            (models.Task.title.ilike(like)) | (models.Task.description.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(type="task", id=t.id, title=t.title, subtitle="Task", path="/tasks")
        for t in tasks
    ]

    subjects = (
        db.query(models.Subject)
        .filter(
            models.Subject.user_id == current_user.id,
            (models.Subject.name.ilike(like)) | (models.Subject.code.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="subject", id=s.id, title=s.name, subtitle="Subject", path=f"/study-hub/{s.id}"
        )
        for s in subjects
    ]

    assignments = (
        db.query(models.Assignment)
        .filter(
            models.Assignment.subject_id.in_(owned_subject_ids),
            (models.Assignment.title.ilike(like)) | (models.Assignment.description.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="assignment",
            id=a.id,
            title=a.title,
            subtitle="Assignment",
            path=f"/study-hub/{a.subject_id}" if a.subject_id else "/study-hub",
        )
        for a in assignments
    ]

    notes = (
        db.query(models.Note)
        .filter(models.Note.subject_id.in_(owned_subject_ids), models.Note.title.ilike(like))
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="note",
            id=n.id,
            title=n.title,
            subtitle="Note",
            path=f"/study-hub/{n.subject_id}" if n.subject_id else "/study-hub",
        )
        for n in notes
    ]

    projects = (
        db.query(models.Project)
        .filter(
            models.Project.id.in_(accessible_project_ids),
            (models.Project.name.ilike(like)) | (models.Project.description.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="project", id=p.id, title=p.name, subtitle="Project", path=f"/projects/{p.id}"
        )
        for p in projects
    ]

    todos = (
        db.query(models.ProjectTodo)
        .filter(
            models.ProjectTodo.project_id.in_(accessible_project_ids),
            (models.ProjectTodo.title.ilike(like)) | (models.ProjectTodo.description.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="todo", id=t.id, title=t.title, subtitle="Project todo", path=f"/projects/{t.project_id}"
        )
        for t in todos
    ]

    features = (
        db.query(models.Feature)
        .filter(
            models.Feature.project_id.in_(accessible_project_ids),
            (models.Feature.title.ilike(like)) | (models.Feature.description.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="feature", id=f.id, title=f.title, subtitle="Feature", path=f"/projects/{f.project_id}"
        )
        for f in features
    ]

    bugs = (
        db.query(models.Bug)
        .filter(
            models.Bug.project_id.in_(accessible_project_ids),
            (models.Bug.title.ilike(like)) | (models.Bug.description.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="bug", id=b.id, title=b.title, subtitle="Bug", path=f"/projects/{b.project_id}"
        )
        for b in bugs
    ]

    milestones = (
        db.query(models.Milestone)
        .filter(
            models.Milestone.project_id.in_(accessible_project_ids),
            models.Milestone.title.ilike(like),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="milestone",
            id=m.id,
            title=m.title,
            subtitle="Milestone",
            path=f"/projects/{m.project_id}",
        )
        for m in milestones
    ]

    ai_accounts = (
        db.query(models.AIAccount)
        .filter(
            models.AIAccount.user_id == current_user.id,
            (models.AIAccount.name.ilike(like)) | (models.AIAccount.description.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="ai_account", id=a.id, title=a.name, subtitle="AI Account", path="/ai-workspace/accounts"
        )
        for a in ai_accounts
    ]

    conversations = (
        db.query(models.Conversation)
        .filter(
            or_(
                models.Conversation.ai_account_id.in_(owned_account_ids),
                models.Conversation.project_id.in_(accessible_project_ids),
            ),
            (models.Conversation.title.ilike(like)) | (models.Conversation.summary.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="conversation",
            id=c.id,
            title=c.title,
            subtitle="Conversation",
            path=f"/ai-workspace/conversations/{c.id}",
        )
        for c in conversations
    ]

    prompt_templates = (
        db.query(models.PromptTemplate)
        .filter(
            models.PromptTemplate.user_id == current_user.id,
            (models.PromptTemplate.title.ilike(like)) | (models.PromptTemplate.content.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="prompt_template",
            id=p.id,
            title=p.title,
            subtitle="Prompt Template",
            path="/ai-workspace/prompts",
        )
        for p in prompt_templates
    ]

    knowledge_articles = (
        db.query(models.KnowledgeArticle)
        .filter(
            or_(
                models.KnowledgeArticle.user_id == current_user.id,
                models.KnowledgeArticle.project_id.in_(accessible_project_ids),
            ),
            (models.KnowledgeArticle.title.ilike(like)) | (models.KnowledgeArticle.content.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="knowledge_article",
            id=k.id,
            title=k.title,
            subtitle="Knowledge Article",
            path="/ai-workspace/knowledge",
        )
        for k in knowledge_articles
    ]

    project_zips = (
        db.query(models.ProjectZip)
        .filter(
            models.ProjectZip.project_id.in_(accessible_project_ids),
            (models.ProjectZip.version_label.ilike(like)) | (models.ProjectZip.original_name.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="project_zip",
            id=z.id,
            title=z.version_label or z.original_name or "Zip snapshot",
            subtitle="Project Zip",
            path=f"/projects/{z.project_id}",
        )
        for z in project_zips
    ]

    ai_handoffs = (
        db.query(models.AIHandoff)
        .filter(
            or_(
                models.AIHandoff.project_id.in_(accessible_project_ids),
                models.AIHandoff.ai_account_id.in_(owned_account_ids),
                models.AIHandoff.conversation_id.in_(owned_conversation_ids),
            ),
            (models.AIHandoff.completed_work.ilike(like)) | (models.AIHandoff.next_objective.ilike(like)),
        )
        .limit(MAX_PER_TYPE)
        .all()
    )
    results += [
        schemas.GlobalSearchItem(
            type="ai_handoff",
            id=h.id,
            title=(h.completed_work or h.next_objective or "Handoff")[:80],
            subtitle="AI Handoff",
            path="/ai-workspace/handoffs",
        )
        for h in ai_handoffs
    ]

    return schemas.GlobalSearchResult(query=q, results=results)
