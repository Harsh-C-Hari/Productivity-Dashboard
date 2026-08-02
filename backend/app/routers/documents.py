"""
CRUD endpoints for Project Documents (markdown documentation pages
belonging to a project). Mirrors `routers/notes.py`'s shape closely --
title/content search, ordered listing -- minus attachments, since a
Document is a page of prose, not a note with files attached.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/documents", tags=["project-workspace"])


def serialize_document(document: models.ProjectDocument) -> schemas.ProjectDocumentOut:
    return schemas.ProjectDocumentOut.model_validate(document)


def get_document_or_404(db: Session, document_id: str) -> models.ProjectDocument:
    document = db.query(models.ProjectDocument).filter(models.ProjectDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("", response_model=List[schemas.ProjectDocumentOut])
def list_documents(
    project_id: str = Query(..., description="Only documents on this project are ever returned."),
    q: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user, project_id, "view_project")
    query = db.query(models.ProjectDocument).filter(models.ProjectDocument.project_id == project_id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(models.ProjectDocument.title.ilike(like), models.ProjectDocument.content.ilike(like)))
    documents = query.order_by(models.ProjectDocument.order_index.asc(), models.ProjectDocument.created_at.asc()).all()
    return [serialize_document(d) for d in documents]


@router.get("/{document_id}", response_model=schemas.ProjectDocumentOut)
def get_document(document_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    require_project_access(db, current_user, document.project_id, "view_project")
    return serialize_document(document)


@router.post("", response_model=schemas.ProjectDocumentOut, status_code=201)
def create_document(payload: schemas.ProjectDocumentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, payload.project_id, "manage_documents")

    document = models.ProjectDocument(**payload.model_dump())
    db.add(document)
    db.commit()
    db.refresh(document)
    log_activity(db, f'Added document "{document.title}" to {project.name}', icon="file-text")
    log_timeline_event(
        db, project.id, "document_created", f'Document "{document.title}" added',
        related_entity_type="document", related_entity_id=document.id, icon="file-text",
    )
    return serialize_document(document)


@router.patch("/{document_id}", response_model=schemas.ProjectDocumentOut)
def update_document(document_id: str, payload: schemas.ProjectDocumentUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    require_project_access(db, current_user, document.project_id, "manage_documents")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(document, field, value)
    document.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(document)
    log_activity(db, f'Updated document "{document.title}"', icon="pencil")
    return serialize_document(document)


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    require_project_access(db, current_user, document.project_id, "manage_documents")
    title = document.title
    db.delete(document)
    db.commit()
    log_activity(db, f'Deleted document "{title}"', icon="trash-2")
    return None
