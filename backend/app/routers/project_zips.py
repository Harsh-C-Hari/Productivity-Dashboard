"""
CRUD endpoints for Project Zips -- point-in-time zip *snapshots* of a
project handed off to/from an AI account or conversation.

Scope note: this router manages ZIP metadata + the zip file itself
(upload/replace/delete), reusing `uploads.py` exactly as
`project_resources.py` already does -- no second upload implementation.
Git Sync (turning these into a synced Git history) is out of scope here
per AI_HANDOFF.md's "Planned" list and is intentionally not touched.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..uploads import save_upload, delete_upload, SUPABASE_ZIPS_BUCKET
from ..project_helpers import log_timeline_event, get_accessible_project_ids
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/project-zips", tags=["ai-workspace"])


def serialize_zip(zip_row: models.ProjectZip) -> schemas.ProjectZipOut:
    return schemas.ProjectZipOut.model_validate(zip_row)


def get_zip_or_404(db: Session, zip_id: str) -> models.ProjectZip:
    zip_row = db.query(models.ProjectZip).filter(models.ProjectZip.id == zip_id).first()
    if not zip_row:
        raise HTTPException(status_code=404, detail="Project zip not found")
    return zip_row


@router.get("", response_model=List[schemas.ProjectZipOut])
def list_project_zips(
    project_id: Optional[str] = Query(
        default=None,
        description="Zips on this project only. Omit to list across every project the "
        "current user can access (used by ZIP Manager's \"All projects\" filter).",
    ),
    ai_account_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if project_id:
        require_project_access(db, current_user, project_id, "view_ai_workspace")
        query = db.query(models.ProjectZip).filter(models.ProjectZip.project_id == project_id)
    else:
        accessible_project_ids = get_accessible_project_ids(db, current_user.id)
        query = db.query(models.ProjectZip).filter(models.ProjectZip.project_id.in_(accessible_project_ids))
    if ai_account_id:
        query = query.filter(models.ProjectZip.ai_account_id == ai_account_id)
    if conversation_id:
        query = query.filter(models.ProjectZip.conversation_id == conversation_id)
    query = query.order_by(models.ProjectZip.created_at.desc())
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return [serialize_zip(z) for z in query.all()]


@router.get("/current", response_model=schemas.ProjectZipOut)
def get_current_project_zip(project_id: str = Query(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The most recent zip snapshot for a project -- "current" state
    handed to/from an AI account."""
    require_project_access(db, current_user, project_id, "view_ai_workspace")
    zip_row = (
        db.query(models.ProjectZip)
        .filter(models.ProjectZip.project_id == project_id)
        .order_by(models.ProjectZip.created_at.desc())
        .first()
    )
    if not zip_row:
        raise HTTPException(status_code=404, detail="No zip snapshots for this project")
    return serialize_zip(zip_row)


@router.get("/{zip_id}", response_model=schemas.ProjectZipOut)
def get_project_zip(zip_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    zip_row = get_zip_or_404(db, zip_id)
    require_project_access(db, current_user, zip_row.project_id, "view_ai_workspace")
    return serialize_zip(zip_row)


@router.post("/upload", response_model=schemas.ProjectZipOut, status_code=201)
async def upload_project_zip(
    project_id: str = Form(...),
    ai_account_id: Optional[str] = Form(default=None),
    conversation_id: Optional[str] = Form(default=None),
    version_label: str = Form(default=""),
    notes: str = Form(default=""),
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Uploads a new zip snapshot for a project (metadata only from the
    AI Workspace's perspective; the zip's *contents* are not parsed or
    diffed here -- see AI_HANDOFF.md's Git Sync notes for that)."""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, project_id, "manage_ai_workspace")

    try:
        meta = await save_upload(file, bucket=SUPABASE_ZIPS_BUCKET)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    zip_row = models.ProjectZip(
        project_id=project_id,
        ai_account_id=ai_account_id or None,
        conversation_id=conversation_id or None,
        version_label=version_label,
        file_name=meta["filename"],
        original_name=meta["original_name"],
        file_path=meta["url"],
        file_size_bytes=meta["size_bytes"],
        notes=notes,
    )
    db.add(zip_row)
    db.commit()
    db.refresh(zip_row)

    log_activity(db, f'Uploaded project zip "{zip_row.original_name}" for {project.name}', icon="archive")
    log_timeline_event(
        db, project.id, "zip_uploaded", f'Zip snapshot "{zip_row.version_label or zip_row.original_name}" uploaded',
        related_entity_type="project_zip", related_entity_id=zip_row.id, icon="archive",
    )
    return serialize_zip(zip_row)


@router.post("/{zip_id}/replace", response_model=schemas.ProjectZipOut)
async def replace_project_zip(
    zip_id: str,
    file: UploadFile = File(...),
    version_label: Optional[str] = Form(default=None),
    notes: Optional[str] = Form(default=None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replaces an existing zip snapshot's file in place (same metadata
    row, new file on disk) -- distinct from uploading a brand new
    snapshot via `/upload`."""
    zip_row = get_zip_or_404(db, zip_id)
    require_project_access(db, current_user, zip_row.project_id, "manage_ai_workspace")
    old_file_name = zip_row.file_name

    try:
        meta = await save_upload(file, bucket=SUPABASE_ZIPS_BUCKET)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    zip_row.file_name = meta["filename"]
    zip_row.original_name = meta["original_name"]
    zip_row.file_path = meta["url"]
    zip_row.file_size_bytes = meta["size_bytes"]
    if version_label is not None:
        zip_row.version_label = version_label
    if notes is not None:
        zip_row.notes = notes
    db.commit()
    db.refresh(zip_row)

    if old_file_name:
        delete_upload(old_file_name, bucket=SUPABASE_ZIPS_BUCKET)

    log_activity(db, f'Replaced project zip "{zip_row.original_name}"', icon="refresh-cw")
    if zip_row.project_id:
        log_timeline_event(
            db, zip_row.project_id, "zip_replaced",
            f'Zip snapshot "{zip_row.version_label or zip_row.original_name}" replaced',
            related_entity_type="project_zip", related_entity_id=zip_row.id, icon="refresh-cw",
        )
    return serialize_zip(zip_row)


@router.patch("/{zip_id}", response_model=schemas.ProjectZipOut)
def update_project_zip(zip_id: str, payload: schemas.ProjectZipUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    zip_row = get_zip_or_404(db, zip_id)
    require_project_access(db, current_user, zip_row.project_id, "manage_ai_workspace")
    data = payload.model_dump(exclude_unset=True)
    clear_ai_account = data.pop("clear_ai_account", False)
    clear_conversation = data.pop("clear_conversation", False)
    for field, value in data.items():
        setattr(zip_row, field, value)
    if clear_ai_account:
        zip_row.ai_account_id = None
    if clear_conversation:
        zip_row.conversation_id = None
    db.commit()
    db.refresh(zip_row)
    return serialize_zip(zip_row)


@router.delete("/{zip_id}", status_code=204)
def delete_project_zip(zip_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    zip_row = get_zip_or_404(db, zip_id)
    require_project_access(db, current_user, zip_row.project_id, "manage_ai_workspace")
    if zip_row.file_name:
        delete_upload(zip_row.file_name, bucket=SUPABASE_ZIPS_BUCKET)
    label = zip_row.version_label or zip_row.original_name or zip_row.id
    db.delete(zip_row)
    db.commit()
    log_activity(db, f'Removed project zip "{label}"', icon="trash-2")
    return None
