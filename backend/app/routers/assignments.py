"""
CRUD endpoints for assignments (subject-scoped academic work items), plus
urgency injection and file attachment upload/removal.

Mirrors `routers/tasks.py` closely: every response passes through
`serialize_assignment`, which computes the current urgency tier on the
fly using the same Smart Urgency engine Tasks use.
"""
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..urgency import compute_urgency
from ..activity_log import log_activity
from ..uploads import save_upload, delete_upload

router = APIRouter(prefix="/api/assignments", tags=["study-hub"])


def serialize_assignment(
    assignment: models.Assignment, subject: Optional[models.Subject] = None
) -> schemas.AssignmentOut:
    urgency = compute_urgency(
        deadline=assignment.deadline,
        estimated_effort_hours=assignment.estimated_effort_hours or 0,
        progress=assignment.progress or 0,
        status=assignment.status.value if hasattr(assignment.status, "value") else assignment.status,
    )
    out = schemas.AssignmentOut.model_validate(
        {
            "id": assignment.id,
            "subject_id": assignment.subject_id,
            "topic_id": assignment.topic_id,
            "title": assignment.title,
            "description": assignment.description,
            "deadline": assignment.deadline,
            "estimated_effort_hours": assignment.estimated_effort_hours,
            "status": assignment.status,
            "progress": assignment.progress,
            "created_at": assignment.created_at,
            "updated_at": assignment.updated_at,
            "completed_at": assignment.completed_at,
            "attachments": json.loads(assignment.attachments or "[]"),
        }
    )
    out.urgency = urgency
    if subject:
        out.subject_name = subject.name
        out.subject_color = subject.color
    return out


def _get_subject_map(db: Session) -> dict:
    return {s.id: s for s in db.query(models.Subject).all()}


@router.get("", response_model=List[schemas.AssignmentOut])
def list_assignments(
    subject_id: Optional[str] = None,
    topic_id: Optional[str] = None,
    status: Optional[models.AssignmentStatus] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Assignment)
    if subject_id:
        query = query.filter(models.Assignment.subject_id == subject_id)
    if topic_id:
        query = query.filter(models.Assignment.topic_id == topic_id)
    if status:
        query = query.filter(models.Assignment.status == status)
    assignments = query.order_by(
        models.Assignment.deadline.is_(None), models.Assignment.deadline.asc()
    ).all()

    subjects = _get_subject_map(db)
    return [serialize_assignment(a, subjects.get(a.subject_id)) for a in assignments]


@router.get("/{assignment_id}", response_model=schemas.AssignmentOut)
def get_assignment(assignment_id: str, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    subject = db.query(models.Subject).filter(models.Subject.id == assignment.subject_id).first()
    return serialize_assignment(assignment, subject)


@router.post("", response_model=schemas.AssignmentOut, status_code=201)
def create_assignment(payload: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if payload.topic_id:
        topic = db.query(models.Topic).filter(models.Topic.id == payload.topic_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

    assignment = models.Assignment(**payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    log_activity(db, f'Added assignment "{assignment.title}" ({subject.name})', icon="plus-circle")
    return serialize_assignment(assignment, subject)


@router.patch("/{assignment_id}", response_model=schemas.AssignmentOut)
def update_assignment(assignment_id: str, payload: schemas.AssignmentUpdate, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    data = payload.model_dump(exclude_unset=True)
    clear_deadline = data.pop("clear_deadline", False)
    clear_topic = data.pop("clear_topic", False)

    was_done = assignment.status == models.AssignmentStatus.done

    for field, value in data.items():
        setattr(assignment, field, value)

    if clear_deadline:
        assignment.deadline = None
    if clear_topic:
        assignment.topic_id = None

    if assignment.status == models.AssignmentStatus.done:
        assignment.progress = 100
        if not was_done:
            assignment.completed_at = datetime.utcnow()
    elif was_done and assignment.status != models.AssignmentStatus.done:
        assignment.completed_at = None

    if assignment.progress == 100 and assignment.status != models.AssignmentStatus.done:
        assignment.status = models.AssignmentStatus.done
        assignment.completed_at = datetime.utcnow()

    assignment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assignment)

    subject = db.query(models.Subject).filter(models.Subject.id == assignment.subject_id).first()

    if assignment.status == models.AssignmentStatus.done and not was_done:
        log_activity(db, f'Completed assignment "{assignment.title}"', icon="check-circle")
    else:
        log_activity(db, f'Updated assignment "{assignment.title}"', icon="pencil")

    return serialize_assignment(assignment, subject)


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: str, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    title = assignment.title
    for att in json.loads(assignment.attachments or "[]"):
        delete_upload(att["filename"])
    db.delete(assignment)
    db.commit()
    log_activity(db, f'Deleted assignment "{title}"', icon="trash-2")
    return None


# ---------- Attachments ----------

@router.post("/{assignment_id}/attachments", response_model=schemas.AssignmentOut)
async def upload_assignment_attachment(
    assignment_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    try:
        meta = await save_upload(file)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    attachments = json.loads(assignment.attachments or "[]")
    attachments.append(meta)
    assignment.attachments = json.dumps(attachments)
    assignment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assignment)

    subject = db.query(models.Subject).filter(models.Subject.id == assignment.subject_id).first()
    log_activity(db, f'Attached "{meta["original_name"]}" to "{assignment.title}"', icon="paperclip")
    return serialize_assignment(assignment, subject)


@router.delete("/{assignment_id}/attachments/{filename}", response_model=schemas.AssignmentOut)
def delete_assignment_attachment(assignment_id: str, filename: str, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    attachments = json.loads(assignment.attachments or "[]")
    remaining = [a for a in attachments if a["filename"] != filename]
    if len(remaining) == len(attachments):
        raise HTTPException(status_code=404, detail="Attachment not found")

    delete_upload(filename)
    assignment.attachments = json.dumps(remaining)
    assignment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assignment)

    subject = db.query(models.Subject).filter(models.Subject.id == assignment.subject_id).first()
    return serialize_assignment(assignment, subject)
