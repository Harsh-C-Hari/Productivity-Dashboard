"""
CRUD endpoints for Prompt Templates (reusable prompt text, independent
of any project/account). Mirrors `notes.py`'s markdown-content shape,
plus category/tag-style filtering matching `knowledge_articles.py`.

"Favorites" has no dedicated boolean column on `PromptTemplate` (see
AI_HANDOFF.md -- Conversation 1 only defined title/description/content/
category/variables/usage_count), so favorites are exposed as a
category value (`category=favorite`) rather than a schema change,
consistent with "DO NOT recreate schemas."
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity

router = APIRouter(prefix="/api/prompt-templates", tags=["ai-workspace"])

FAVORITE_CATEGORY = "favorite"


def serialize_prompt(prompt: models.PromptTemplate) -> schemas.PromptTemplateOut:
    return schemas.PromptTemplateOut.model_validate(
        {
            "id": prompt.id,
            "title": prompt.title,
            "description": prompt.description,
            "content": prompt.content,
            "category": prompt.category,
            "variables": json.loads(prompt.variables or "[]"),
            "usage_count": prompt.usage_count,
            "created_at": prompt.created_at,
            "updated_at": prompt.updated_at,
        }
    )


def get_prompt_or_404(db: Session, prompt_id: str) -> models.PromptTemplate:
    prompt = db.query(models.PromptTemplate).filter(models.PromptTemplate.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return prompt


@router.get("", response_model=List[schemas.PromptTemplateOut])
def list_prompt_templates(
    category: Optional[str] = None,
    favorites_only: bool = False,
    q: Optional[str] = None,
    sort_by: str = Query(default="updated_at", pattern="^(title|usage_count|created_at|updated_at)$"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(models.PromptTemplate)
    if favorites_only:
        query = query.filter(models.PromptTemplate.category == FAVORITE_CATEGORY)
    elif category:
        query = query.filter(models.PromptTemplate.category == category)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.PromptTemplate.title.ilike(like))
            | (models.PromptTemplate.description.ilike(like))
            | (models.PromptTemplate.content.ilike(like))
        )

    sort_col = getattr(models.PromptTemplate, sort_by)
    query = query.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())

    if limit is not None:
        query = query.offset(offset).limit(limit)
    return [serialize_prompt(p) for p in query.all()]


@router.get("/recent", response_model=List[schemas.PromptTemplateOut])
def recent_prompt_templates(limit: int = Query(default=10, ge=1, le=50), db: Session = Depends(get_db)):
    prompts = (
        db.query(models.PromptTemplate)
        .order_by(models.PromptTemplate.updated_at.desc())
        .limit(limit)
        .all()
    )
    return [serialize_prompt(p) for p in prompts]


@router.get("/categories", response_model=List[str])
def list_prompt_categories(db: Session = Depends(get_db)):
    rows = db.query(models.PromptTemplate.category).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


@router.get("/{prompt_id}", response_model=schemas.PromptTemplateOut)
def get_prompt_template(prompt_id: str, db: Session = Depends(get_db)):
    return serialize_prompt(get_prompt_or_404(db, prompt_id))


@router.post("", response_model=schemas.PromptTemplateOut, status_code=201)
def create_prompt_template(payload: schemas.PromptTemplateCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    variables = data.pop("variables", [])
    prompt = models.PromptTemplate(**data, variables=json.dumps(variables))
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    log_activity(db, f'Added prompt "{prompt.title}"', icon="file-text")
    return serialize_prompt(prompt)


@router.post("/{prompt_id}/duplicate", response_model=schemas.PromptTemplateOut, status_code=201)
def duplicate_prompt_template(prompt_id: str, db: Session = Depends(get_db)):
    original = get_prompt_or_404(db, prompt_id)
    copy = models.PromptTemplate(
        title=f"{original.title} (copy)",
        description=original.description,
        content=original.content,
        category=original.category,
        variables=original.variables,
        usage_count=0,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    log_activity(db, f'Duplicated prompt "{original.title}"', icon="copy")
    return serialize_prompt(copy)


@router.post("/{prompt_id}/use", response_model=schemas.PromptTemplateOut)
def record_prompt_usage(prompt_id: str, db: Session = Depends(get_db)):
    """Increments usage_count, used when a prompt is copied/applied in
    the frontend -- feeds "recent"/"most used" sorting."""
    prompt = get_prompt_or_404(db, prompt_id)
    prompt.usage_count = (prompt.usage_count or 0) + 1
    db.commit()
    db.refresh(prompt)
    return serialize_prompt(prompt)


@router.patch("/{prompt_id}", response_model=schemas.PromptTemplateOut)
def update_prompt_template(prompt_id: str, payload: schemas.PromptTemplateUpdate, db: Session = Depends(get_db)):
    prompt = get_prompt_or_404(db, prompt_id)
    data = payload.model_dump(exclude_unset=True)
    if "variables" in data:
        data["variables"] = json.dumps(data["variables"] or [])
    for field, value in data.items():
        setattr(prompt, field, value)
    db.commit()
    db.refresh(prompt)
    log_activity(db, f'Updated prompt "{prompt.title}"', icon="file-text")
    return serialize_prompt(prompt)


@router.delete("/{prompt_id}", status_code=204)
def delete_prompt_template(prompt_id: str, db: Session = Depends(get_db)):
    prompt = get_prompt_or_404(db, prompt_id)
    title = prompt.title
    db.delete(prompt)
    db.commit()
    log_activity(db, f'Removed prompt "{title}"', icon="trash-2")
    return None
