"""
CRUD endpoints for subjects (courses/classes) and the topics/modules
nested within them. Subjects are the organizing unit for the rest of the
Study Hub: assignments, notes, and resources all reference a subject_id.

Personal module (see PROJECT_CONTEXT.md / task brief "PERSONAL MODULES"):
every Subject belongs to exactly one user via `Subject.user_id`. Topics
have no user_id of their own -- they inherit the owning Subject's
ownership, so every topic endpoint below resolves the parent Subject
first and checks ownership on that, the same "child inherits from
parent" pattern used for Project content elsewhere in the app.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..auth_dependencies import get_current_user
from ..ownership_helpers import get_owned_or_404, owned_query
from ..uploads import delete_upload

router = APIRouter(prefix="/api/subjects", tags=["study-hub"])
topics_router = APIRouter(prefix="/api/topics", tags=["study-hub"])


def _get_owned_subject(db: Session, subject_id: str, user_id: str) -> models.Subject:
    return get_owned_or_404(db, models.Subject, subject_id, user_id, "Subject not found")


@router.get("", response_model=List[schemas.SubjectOut])
def list_subjects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return owned_query(db, models.Subject, current_user.id).order_by(models.Subject.name.asc()).all()


@router.get("/{subject_id}", response_model=schemas.SubjectOut)
def get_subject(subject_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return _get_owned_subject(db, subject_id, current_user.id)


@router.post("", response_model=schemas.SubjectOut, status_code=201)
def create_subject(
    payload: schemas.SubjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    subject = models.Subject(**payload.model_dump(), user_id=current_user.id)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    log_activity(db, f'Added subject "{subject.name}"', icon="graduation-cap", user_id=current_user.id)
    return subject


@router.patch("/{subject_id}", response_model=schemas.SubjectOut)
def update_subject(
    subject_id: str,
    payload: schemas.SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    subject = _get_owned_subject(db, subject_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    db.commit()
    db.refresh(subject)
    log_activity(db, f'Updated subject "{subject.name}"', icon="pencil", user_id=current_user.id)
    return subject


@router.delete("/{subject_id}", status_code=204)
def delete_subject(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Deletes a subject and everything scoped to it. SQLite doesn't
    enforce ON DELETE CASCADE by default, so related rows (and their
    uploaded files) are cleaned up explicitly here."""
    subject = _get_owned_subject(db, subject_id, current_user.id)
    name = subject.name

    for resource in db.query(models.Resource).filter(models.Resource.subject_id == subject_id).all():
        if resource.file_name:
            delete_upload(resource.file_name)
        db.delete(resource)

    for note in db.query(models.Note).filter(models.Note.subject_id == subject_id).all():
        for att in json.loads(note.attachments or "[]"):
            delete_upload(att["filename"])
        db.delete(note)

    for assignment in db.query(models.Assignment).filter(models.Assignment.subject_id == subject_id).all():
        for att in json.loads(assignment.attachments or "[]"):
            delete_upload(att["filename"])
        db.delete(assignment)
    db.query(models.StudySession).filter(models.StudySession.subject_id == subject_id).update(
        {models.StudySession.subject_id: None}
    )
    db.query(models.Topic).filter(models.Topic.subject_id == subject_id).delete()

    db.delete(subject)
    db.commit()
    log_activity(db, f'Deleted subject "{name}"', icon="trash-2", user_id=current_user.id)
    return None


# ---------- Topics ----------

@topics_router.get("", response_model=List[schemas.TopicOut])
def list_topics(
    subject_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Topic).join(models.Subject, models.Topic.subject_id == models.Subject.id).filter(
        models.Subject.user_id == current_user.id
    )
    if subject_id:
        query = query.filter(models.Topic.subject_id == subject_id)
    return query.order_by(models.Topic.order_index.asc(), models.Topic.created_at.asc()).all()


@topics_router.post("", response_model=schemas.TopicOut, status_code=201)
def create_topic(
    payload: schemas.TopicCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    subject = _get_owned_subject(db, payload.subject_id, current_user.id)
    topic = models.Topic(**payload.model_dump())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    log_activity(db, f'Added topic "{topic.title}" to {subject.name}', icon="list-tree", user_id=current_user.id)
    return topic


def _get_owned_topic(db: Session, topic_id: str, user_id: str) -> models.Topic:
    topic = (
        db.query(models.Topic)
        .join(models.Subject, models.Topic.subject_id == models.Subject.id)
        .filter(models.Topic.id == topic_id, models.Subject.user_id == user_id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@topics_router.patch("/{topic_id}", response_model=schemas.TopicOut)
def update_topic(
    topic_id: str,
    payload: schemas.TopicUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    topic = _get_owned_topic(db, topic_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    db.commit()
    db.refresh(topic)
    return topic


@topics_router.delete("/{topic_id}", status_code=204)
def delete_topic(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    topic = _get_owned_topic(db, topic_id, current_user.id)
    db.delete(topic)
    db.commit()
    return None
