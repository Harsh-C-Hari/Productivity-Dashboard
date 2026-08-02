"""
CRUD endpoints for Knowledge Articles -- durable markdown reference
notes, optionally scoped to a project. Mirrors `documents.py`
(Project Documents) closely since `KnowledgeArticle` was deliberately
given the same shape (see models.py docstring).

"Pinned"/"Favorites" have no dedicated boolean column (Conversation 1
only defined project_id/title/content/category/tags/source -- see
AI_HANDOFF.md), so both are exposed via the `category` field
(`category=pinned` / `category=favorite`) rather than a schema change,
same approach as `prompt_templates.py`'s favorites.
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

router = APIRouter(prefix="/api/knowledge-articles", tags=["ai-workspace"])

PINNED_CATEGORY = "pinned"
FAVORITE_CATEGORY = "favorite"


def serialize_article(article: models.KnowledgeArticle) -> schemas.KnowledgeArticleOut:
    return schemas.KnowledgeArticleOut.model_validate(
        {
            "id": article.id,
            "project_id": article.project_id,
            "title": article.title,
            "content": article.content,
            "category": article.category,
            "tags": json.loads(article.tags or "[]"),
            "source": article.source,
            "created_at": article.created_at,
            "updated_at": article.updated_at,
        }
    )


def get_article_or_404(db: Session, article_id: str) -> models.KnowledgeArticle:
    article = db.query(models.KnowledgeArticle).filter(models.KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Knowledge article not found")
    return article


@router.get("", response_model=List[schemas.KnowledgeArticleOut])
def list_knowledge_articles(
    project_id: Optional[str] = None,
    category: Optional[str] = None,
    pinned_only: bool = False,
    favorites_only: bool = False,
    source: Optional[models.KnowledgeSource] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
    sort_by: str = Query(default="updated_at", pattern="^(title|created_at|updated_at)$"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if project_id:
        require_project_access(db, current_user, project_id, "view_ai_workspace")
    query = db.query(models.KnowledgeArticle)
    if project_id:
        query = query.filter(models.KnowledgeArticle.project_id == project_id)
    if pinned_only:
        query = query.filter(models.KnowledgeArticle.category == PINNED_CATEGORY)
    elif favorites_only:
        query = query.filter(models.KnowledgeArticle.category == FAVORITE_CATEGORY)
    elif category:
        query = query.filter(models.KnowledgeArticle.category == category)
    if source:
        query = query.filter(models.KnowledgeArticle.source == source)
    if tag:
        query = query.filter(models.KnowledgeArticle.tags.ilike(f'%"{tag}"%'))
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.KnowledgeArticle.title.ilike(like)) | (models.KnowledgeArticle.content.ilike(like))
        )

    sort_col = getattr(models.KnowledgeArticle, sort_by)
    query = query.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())

    if limit is not None:
        query = query.offset(offset).limit(limit)
    return [serialize_article(a) for a in query.all()]


@router.get("/categories", response_model=List[str])
def list_knowledge_categories(db: Session = Depends(get_db)):
    rows = db.query(models.KnowledgeArticle.category).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


@router.get("/{article_id}", response_model=schemas.KnowledgeArticleOut)
def get_knowledge_article(article_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    article = get_article_or_404(db, article_id)
    if article.project_id:
        require_project_access(db, current_user, article.project_id, "view_ai_workspace")
    return serialize_article(article)


@router.post("", response_model=schemas.KnowledgeArticleOut, status_code=201)
def create_knowledge_article(payload: schemas.KnowledgeArticleCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.project_id:
        project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        require_project_access(db, current_user, payload.project_id, "manage_ai_workspace")

    data = payload.model_dump()
    tags = data.pop("tags", [])
    article = models.KnowledgeArticle(**data, tags=json.dumps(tags))
    db.add(article)
    db.commit()
    db.refresh(article)

    log_activity(db, f'Added knowledge article "{article.title}"', icon="book-open")
    if article.project_id:
        log_timeline_event(
            db, article.project_id, "knowledge_article_added", f'Knowledge article "{article.title}" added',
            related_entity_type="knowledge_article", related_entity_id=article.id, icon="book-open",
        )
    return serialize_article(article)


@router.patch("/{article_id}", response_model=schemas.KnowledgeArticleOut)
def update_knowledge_article(article_id: str, payload: schemas.KnowledgeArticleUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    article = get_article_or_404(db, article_id)
    if article.project_id:
        require_project_access(db, current_user, article.project_id, "manage_ai_workspace")
    data = payload.model_dump(exclude_unset=True)
    clear_project = data.pop("clear_project", False)

    if data.get("project_id"):
        project = db.query(models.Project).filter(models.Project.id == data["project_id"]).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        require_project_access(db, current_user, data["project_id"], "manage_ai_workspace")

    if "tags" in data:
        data["tags"] = json.dumps(data["tags"] or [])

    for field, value in data.items():
        setattr(article, field, value)
    if clear_project:
        article.project_id = None

    db.commit()
    db.refresh(article)
    return serialize_article(article)


@router.delete("/{article_id}", status_code=204)
def delete_knowledge_article(article_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    article = get_article_or_404(db, article_id)
    if article.project_id:
        require_project_access(db, current_user, article.project_id, "manage_ai_workspace")
    title = article.title
    db.delete(article)
    db.commit()
    log_activity(db, f'Removed knowledge article "{title}"', icon="trash-2")
    return None
