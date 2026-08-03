"""
CRUD endpoints for subject-scoped study notes, plus file attachments and
simple title/content search.

Personal module: Note has no user_id of its own -- ownership is
inherited from its parent Subject (see subjects.py's module docstring
for why), so every lookup here joins through Subject and filters on
Subject.user_id.
"""
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..auth_dependencies import get_current_user
from ..uploads import save_upload, delete_upload

router = APIRouter(prefix="/api/notes", tags=["study-hub"])


def serialize_note(note: models.Note, subject: Optional[models.Subject] = None) -> schemas.NoteOut:
    out = schemas.NoteOut.model_validate(
        {
            "id": note.id,
            "subject_id": note.subject_id,
            "topic_id": note.topic_id,
            "title": note.title,
            "content": note.content,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
            "attachments": json.loads(note.attachments or "[]"),
        }
    )
    if subject:
        out.subject_name = subject.name
        out.subject_color = subject.color
    return out


def _get_owned_note(db: Session, note_id: str, user_id: str) -> models.Note:
    note = (
        db.query(models.Note)
        .join(models.Subject, models.Note.subject_id == models.Subject.id)
        .filter(models.Note.id == note_id, models.Subject.user_id == user_id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.get("", response_model=List[schemas.NoteOut])
def list_notes(
    subject_id: Optional[str] = None,
    topic_id: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Note).join(models.Subject, models.Note.subject_id == models.Subject.id).filter(
        models.Subject.user_id == current_user.id
    )
    if subject_id:
        query = query.filter(models.Note.subject_id == subject_id)
    if topic_id:
        query = query.filter(models.Note.topic_id == topic_id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.Note.title.ilike(like)) | (models.Note.content.ilike(like))
        )
    notes = query.order_by(models.Note.updated_at.desc()).all()

    subjects = {s.id: s for s in owned_subjects(db, current_user.id)}
    return [serialize_note(n, subjects.get(n.subject_id)) for n in notes]


def owned_subjects(db: Session, user_id: str):
    return db.query(models.Subject).filter(models.Subject.user_id == user_id).all()


@router.get("/{note_id}", response_model=schemas.NoteOut)
def get_note(note_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = _get_owned_note(db, note_id, current_user.id)
    subject = db.query(models.Subject).filter(models.Subject.id == note.subject_id).first()
    return serialize_note(note, subject)


@router.post("", response_model=schemas.NoteOut, status_code=201)
def create_note(
    payload: schemas.NoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    subject = db.query(models.Subject).filter(
        models.Subject.id == payload.subject_id, models.Subject.user_id == current_user.id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    note = models.Note(**payload.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    log_activity(db, f'Added note "{note.title}" ({subject.name})', icon="notebook-pen", user_id=current_user.id)
    return serialize_note(note, subject)


@router.patch("/{note_id}", response_model=schemas.NoteOut)
def update_note(
    note_id: str,
    payload: schemas.NoteUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    note = _get_owned_note(db, note_id, current_user.id)

    data = payload.model_dump(exclude_unset=True)
    clear_topic = data.pop("clear_topic", False)
    for field, value in data.items():
        setattr(note, field, value)
    if clear_topic:
        note.topic_id = None

    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    subject = db.query(models.Subject).filter(models.Subject.id == note.subject_id).first()
    return serialize_note(note, subject)


@router.delete("/{note_id}", status_code=204)
def delete_note(note_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = _get_owned_note(db, note_id, current_user.id)
    for att in json.loads(note.attachments or "[]"):
        delete_upload(att["filename"])
    db.delete(note)
    db.commit()
    log_activity(db, f'Deleted note "{note.title}"', icon="trash-2", user_id=current_user.id)
    return None


# ---------- Attachments ----------

@router.post("/{note_id}/attachments", response_model=schemas.NoteOut)
async def upload_note_attachment(
    note_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    note = _get_owned_note(db, note_id, current_user.id)

    try:
        meta = await save_upload(file)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    attachments = json.loads(note.attachments or "[]")
    attachments.append(meta)
    note.attachments = json.dumps(attachments)
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    subject = db.query(models.Subject).filter(models.Subject.id == note.subject_id).first()
    return serialize_note(note, subject)


@router.delete("/{note_id}/attachments/{filename}", response_model=schemas.NoteOut)
def delete_note_attachment(
    note_id: str,
    filename: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    note = _get_owned_note(db, note_id, current_user.id)

    attachments = json.loads(note.attachments or "[]")
    remaining = [a for a in attachments if a["filename"] != filename]
    if len(remaining) == len(attachments):
        raise HTTPException(status_code=404, detail="Attachment not found")

    delete_upload(filename)
    note.attachments = json.dumps(remaining)
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    subject = db.query(models.Subject).filter(models.Subject.id == note.subject_id).first()
    return serialize_note(note, subject)
