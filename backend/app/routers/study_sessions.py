"""
CRUD endpoints for logged study sessions (Pomodoro-style timer or manual
entries). A session is "running" while `ended_at` is null; completing it
(via PATCH with `complete_now`, or an explicit `ended_at`) finalizes
`duration_minutes` and is what feeds the streak/hours analytics.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity

router = APIRouter(prefix="/api/study-sessions", tags=["study-hub"])


def serialize_session(
    session: models.StudySession, subject: Optional[models.Subject] = None
) -> schemas.StudySessionOut:
    out = schemas.StudySessionOut.model_validate(session)
    if subject:
        out.subject_name = subject.name
        out.subject_color = subject.color
    return out


@router.get("", response_model=List[schemas.StudySessionOut])
def list_sessions(
    subject_id: Optional[str] = None,
    assignment_id: Optional[str] = None,
    active_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(models.StudySession)
    if subject_id:
        query = query.filter(models.StudySession.subject_id == subject_id)
    if assignment_id:
        query = query.filter(models.StudySession.assignment_id == assignment_id)
    if active_only:
        query = query.filter(models.StudySession.ended_at.is_(None))
    sessions = query.order_by(models.StudySession.started_at.desc()).limit(limit).all()

    subjects = {s.id: s for s in db.query(models.Subject).all()}
    return [serialize_session(s, subjects.get(s.subject_id)) for s in sessions]


@router.post("", response_model=schemas.StudySessionOut, status_code=201)
def start_session(payload: schemas.StudySessionCreate, db: Session = Depends(get_db)):
    if payload.subject_id:
        subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
    if payload.assignment_id:
        assignment = db.query(models.Assignment).filter(models.Assignment.id == payload.assignment_id).first()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

    session = models.StudySession(**payload.model_dump(), started_at=datetime.utcnow())
    db.add(session)
    db.commit()
    db.refresh(session)

    subject = db.query(models.Subject).filter(models.Subject.id == session.subject_id).first() if session.subject_id else None
    return serialize_session(session, subject)


@router.patch("/{session_id}", response_model=schemas.StudySessionOut)
def update_session(session_id: str, payload: schemas.StudySessionUpdate, db: Session = Depends(get_db)):
    session = db.query(models.StudySession).filter(models.StudySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    data = payload.model_dump(exclude_unset=True)
    complete_now = data.pop("complete_now", False)

    for field, value in data.items():
        setattr(session, field, value)

    if complete_now and not session.ended_at:
        session.ended_at = datetime.utcnow()

    if session.ended_at and not data.get("duration_minutes"):
        elapsed = (session.ended_at - session.started_at).total_seconds() / 60
        session.duration_minutes = max(round(elapsed), 0)

    db.commit()
    db.refresh(session)

    subject = db.query(models.Subject).filter(models.Subject.id == session.subject_id).first() if session.subject_id else None

    if complete_now or (payload.ended_at and not data.get("duration_minutes")):
        minutes = session.duration_minutes
        where = f" studying {subject.name}" if subject else ""
        log_activity(db, f"Logged a {minutes}-minute study session{where}", icon="timer")

    return serialize_session(session, subject)


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.StudySession).filter(models.StudySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")
    db.delete(session)
    db.commit()
    return None
