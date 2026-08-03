"""
CRUD endpoints for the per-subject resource library. A resource is either
an uploaded file (PDF/PPT/DOCX/image/ZIP) or an external link; both are
stored as rows in the same `resources` table, distinguished by
`resource_type`.

Personal module: Resource has no user_id of its own -- ownership is
inherited from its parent Subject, same pattern as notes.py.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..auth_dependencies import get_current_user
from ..uploads import save_upload, delete_upload, infer_resource_type

router = APIRouter(prefix="/api/resources", tags=["study-hub"])


def serialize_resource(resource: models.Resource, subject: Optional[models.Subject] = None) -> schemas.ResourceOut:
    out = schemas.ResourceOut.model_validate(resource)
    if subject:
        out.subject_name = subject.name
        out.subject_color = subject.color
    return out


def _get_owned_subject(db: Session, subject_id: str, user_id: str) -> models.Subject:
    subject = db.query(models.Subject).filter(
        models.Subject.id == subject_id, models.Subject.user_id == user_id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


def _get_owned_resource(db: Session, resource_id: str, user_id: str) -> models.Resource:
    resource = (
        db.query(models.Resource)
        .join(models.Subject, models.Resource.subject_id == models.Subject.id)
        .filter(models.Resource.id == resource_id, models.Subject.user_id == user_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.get("", response_model=List[schemas.ResourceOut])
def list_resources(
    subject_id: Optional[str] = None,
    topic_id: Optional[str] = None,
    resource_type: Optional[models.ResourceType] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Resource).join(models.Subject, models.Resource.subject_id == models.Subject.id).filter(
        models.Subject.user_id == current_user.id
    )
    if subject_id:
        query = query.filter(models.Resource.subject_id == subject_id)
    if topic_id:
        query = query.filter(models.Resource.topic_id == topic_id)
    if resource_type:
        query = query.filter(models.Resource.resource_type == resource_type)
    resources = query.order_by(models.Resource.created_at.desc()).all()

    subjects = {s.id: s for s in db.query(models.Subject).filter(models.Subject.user_id == current_user.id).all()}
    return [serialize_resource(r, subjects.get(r.subject_id)) for r in resources]


@router.post("", response_model=schemas.ResourceOut, status_code=201)
def create_link_resource(
    payload: schemas.ResourceLinkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Adds an external-link resource (no file involved)."""
    subject = _get_owned_subject(db, payload.subject_id, current_user.id)

    resource = models.Resource(
        subject_id=payload.subject_id,
        topic_id=payload.topic_id,
        title=payload.title,
        resource_type=models.ResourceType.link,
        external_url=payload.external_url,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    log_activity(db, f'Added link "{resource.title}" to {subject.name}', icon="link", user_id=current_user.id)
    return serialize_resource(resource, subject)


@router.post("/upload", response_model=schemas.ResourceOut, status_code=201)
async def upload_file_resource(
    subject_id: str = Form(...),
    title: str = Form(...),
    topic_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Adds a file-backed resource (PDF/PPT/DOCX/image/ZIP)."""
    subject = _get_owned_subject(db, subject_id, current_user.id)

    try:
        meta = await save_upload(file)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    resource = models.Resource(
        subject_id=subject_id,
        topic_id=topic_id or None,
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
    log_activity(db, f'Uploaded "{resource.title}" to {subject.name}', icon="paperclip", user_id=current_user.id)
    return serialize_resource(resource, subject)


@router.patch("/{resource_id}", response_model=schemas.ResourceOut)
def update_resource(
    resource_id: str,
    payload: schemas.ResourceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    resource = _get_owned_resource(db, resource_id, current_user.id)

    data = payload.model_dump(exclude_unset=True)
    clear_topic = data.pop("clear_topic", False)
    for field, value in data.items():
        setattr(resource, field, value)
    if clear_topic:
        resource.topic_id = None

    db.commit()
    db.refresh(resource)
    subject = db.query(models.Subject).filter(models.Subject.id == resource.subject_id).first()
    return serialize_resource(resource, subject)


@router.delete("/{resource_id}", status_code=204)
def delete_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    resource = _get_owned_resource(db, resource_id, current_user.id)
    if resource.file_name:
        delete_upload(resource.file_name)
    title = resource.title
    db.delete(resource)
    db.commit()
    log_activity(db, f'Removed resource "{title}"', icon="trash-2", user_id=current_user.id)
    return None
