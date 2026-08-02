"""
CRUD endpoints for Project Resources (a project's file/link reference
library). Deliberately mirrors `routers/resources.py` (the Study Hub's
resource library router) almost line for line, reusing the exact same
`uploads.py` helpers (`save_upload`, `delete_upload`,
`infer_resource_type`) -- no second upload implementation, per
PROJECT_CONTEXT.md's "File Upload Rules".

NOTE ON FILE NAME: the task brief asked for this router to be named
`resources.py`, but `backend/app/routers/resources.py` already exists
and is the complete, working Study Hub resource-library router. Per the
"never rewrite/overwrite existing working functionality" rule, this
module is named `project_resources.py` instead so nothing is
overwritten; it is registered in `main.py` under the same
`/api/project-resources` prefix convention as the rest of this file's
endpoints. See AI_HANDOFF.md for the full rationale.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..uploads import save_upload, delete_upload, infer_resource_type
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/project-resources", tags=["project-workspace"])


def serialize_project_resource(resource: models.ProjectResource) -> schemas.ProjectResourceOut:
    return schemas.ProjectResourceOut.model_validate(resource)


def get_resource_or_404(db: Session, resource_id: str) -> models.ProjectResource:
    resource = db.query(models.ProjectResource).filter(models.ProjectResource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.get("", response_model=List[schemas.ProjectResourceOut])
def list_project_resources(
    project_id: str = Query(..., description="Only resources on this project are ever returned."),
    resource_type: Optional[models.ResourceType] = None,
    q: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user, project_id, "view_project")
    query = db.query(models.ProjectResource).filter(models.ProjectResource.project_id == project_id)
    if resource_type:
        query = query.filter(models.ProjectResource.resource_type == resource_type)
    if q:
        query = query.filter(models.ProjectResource.title.ilike(f"%{q}%"))
    resources = query.order_by(models.ProjectResource.created_at.desc()).all()
    return [serialize_project_resource(r) for r in resources]


@router.post("", response_model=schemas.ProjectResourceOut, status_code=201)
def create_link_resource(payload: schemas.ProjectResourceLinkCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Adds an external-link resource (no file involved)."""
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, payload.project_id, "manage_documents")

    resource = models.ProjectResource(
        project_id=payload.project_id,
        title=payload.title,
        resource_type=models.ResourceType.link,
        external_url=payload.external_url,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    log_activity(db, f'Added link "{resource.title}" to {project.name}', icon="link")
    log_timeline_event(
        db, project.id, "resource_added", f'Link "{resource.title}" added',
        related_entity_type="resource", related_entity_id=resource.id, icon="link",
    )
    return serialize_project_resource(resource)


@router.post("/upload", response_model=schemas.ProjectResourceOut, status_code=201)
async def upload_file_resource(
    project_id: str = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adds a file-backed resource (PDF/PPT/DOCX/image/ZIP)."""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, project_id, "manage_documents")

    try:
        meta = await save_upload(file)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    resource = models.ProjectResource(
        project_id=project_id,
        title=title,
        resource_type=infer_resource_type(meta["original_name"]),
        file_name=meta["filename"],
        original_name=meta["original_name"],
        file_path=meta["url"],
        file_size_bytes=meta["size_bytes"],
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    log_activity(db, f'Uploaded "{resource.title}" to {project.name}', icon="paperclip")
    log_timeline_event(
        db, project.id, "resource_added", f'File "{resource.title}" uploaded',
        related_entity_type="resource", related_entity_id=resource.id, icon="paperclip",
    )
    return serialize_project_resource(resource)


@router.patch("/{resource_id}", response_model=schemas.ProjectResourceOut)
def update_project_resource(resource_id: str, payload: schemas.ProjectResourceUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    resource = get_resource_or_404(db, resource_id)
    require_project_access(db, current_user, resource.project_id, "manage_documents")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(resource, field, value)
    db.commit()
    db.refresh(resource)
    return serialize_project_resource(resource)


@router.delete("/{resource_id}", status_code=204)
def delete_project_resource(resource_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    resource = get_resource_or_404(db, resource_id)
    require_project_access(db, current_user, resource.project_id, "manage_documents")
    if resource.file_name:
        delete_upload(resource.file_name)
    title = resource.title
    db.delete(resource)
    db.commit()
    log_activity(db, f'Removed resource "{title}"', icon="trash-2")
    return None
