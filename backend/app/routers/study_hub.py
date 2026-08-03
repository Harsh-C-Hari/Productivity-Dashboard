"""
Study Hub aggregation endpoints: a dashboard-style summary (subjects
progress, upcoming/overdue assignments, today's sessions, analytics) and
a single search endpoint spanning subjects/assignments/notes/resources.

Mirrors the role `routers/dashboard.py` plays for the main dashboard.

Personal module: every helper here takes `user_id` and scopes its
queries to that user's own Subjects (and, for StudySession, the
session's own `user_id` -- see models.py). None of these functions has
a "give me everything" mode any more.
"""
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth_dependencies import get_current_user
from .assignments import serialize_assignment
from .study_sessions import serialize_session
from .notes import serialize_note
from .resources import serialize_resource

router = APIRouter(prefix="/api/study-hub", tags=["study-hub"])


def _compute_streaks(study_dates: set) -> tuple:
    """Returns (current_streak_days, longest_streak_days) from a set of
    `date` objects on which at least one study session was completed."""
    if not study_dates:
        return 0, 0

    today = datetime.utcnow().date()
    current = 0
    cursor = today if today in study_dates else today - timedelta(days=1)
    while cursor in study_dates:
        current += 1
        cursor -= timedelta(days=1)

    longest = 0
    run = 0
    prev = None
    for d in sorted(study_dates):
        run = run + 1 if prev is not None and (d - prev).days == 1 else 1
        longest = max(longest, run)
        prev = d

    return current, longest


def _build_analytics(db: Session, subjects: List[models.Subject], user_id: str) -> schemas.StudyAnalytics:
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)  # rolling 7-day window including today
    fortnight_start = today_start - timedelta(days=13)

    completed_sessions = (
        db.query(models.StudySession)
        .filter(models.StudySession.user_id == user_id, models.StudySession.ended_at.isnot(None))
        .all()
    )

    study_dates = {s.started_at.date() for s in completed_sessions if s.duration_minutes > 0}
    current_streak, longest_streak = _compute_streaks(study_dates)

    total_minutes_all_time = sum(s.duration_minutes for s in completed_sessions)
    week_sessions = [s for s in completed_sessions if s.started_at >= week_start]
    total_minutes_this_week = sum(s.duration_minutes for s in week_sessions)

    # Daily totals for the last 14 days, zero-filled so the chart has a
    # continuous x-axis even on days with no study logged.
    daily_totals = {}
    for s in completed_sessions:
        if s.started_at >= fortnight_start:
            key = s.started_at.date().isoformat()
            daily_totals[key] = daily_totals.get(key, 0) + s.duration_minutes

    daily_minutes = []
    for i in range(14):
        d = (fortnight_start + timedelta(days=i)).date().isoformat()
        daily_minutes.append(schemas.DailyStudyMinutes(date=d, minutes=daily_totals.get(d, 0)))

    hours_by_subject = []
    for subject in subjects:
        minutes = sum(s.duration_minutes for s in completed_sessions if s.subject_id == subject.id)
        hours_by_subject.append(
            schemas.SubjectHours(
                subject_id=subject.id,
                subject_name=subject.name,
                subject_color=subject.color,
                hours=round(minutes / 60, 1),
            )
        )
    hours_by_subject.sort(key=lambda h: h.hours, reverse=True)

    return schemas.StudyAnalytics(
        current_streak_days=current_streak,
        longest_streak_days=longest_streak,
        total_hours_all_time=round(total_minutes_all_time / 60, 1),
        total_hours_this_week=round(total_minutes_this_week / 60, 1),
        sessions_this_week=len(week_sessions),
        daily_minutes_last_14_days=daily_minutes,
        hours_by_subject=hours_by_subject,
    )


def get_subjects_progress(db: Session, user_id: str) -> List[schemas.SubjectProgress]:
    """Per-subject completion/hours summary, shared by the Study Hub
    summary endpoint and the main dashboard's Subject Progress widget."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)

    subjects = db.query(models.Subject).filter(models.Subject.user_id == user_id).order_by(models.Subject.name.asc()).all()
    subject_ids = [s.id for s in subjects]
    all_assignments = db.query(models.Assignment).filter(models.Assignment.subject_id.in_(subject_ids)).all()
    all_topics = db.query(models.Topic).filter(models.Topic.subject_id.in_(subject_ids)).all()
    all_resources = db.query(models.Resource).filter(models.Resource.subject_id.in_(subject_ids)).all()
    all_notes = db.query(models.Note).filter(models.Note.subject_id.in_(subject_ids)).all()
    completed_sessions_this_week = (
        db.query(models.StudySession)
        .filter(
            models.StudySession.user_id == user_id,
            models.StudySession.ended_at.isnot(None),
            models.StudySession.started_at >= week_start,
        )
        .all()
    )

    progress = []
    for subject in subjects:
        s_assignments = [a for a in all_assignments if a.subject_id == subject.id]
        total = len(s_assignments)
        completed = len([a for a in s_assignments if a.status == models.AssignmentStatus.done])
        overdue = len(
            [
                a
                for a in s_assignments
                if a.deadline and a.deadline < now and a.status != models.AssignmentStatus.done
            ]
        )
        minutes_this_week = sum(
            s.duration_minutes for s in completed_sessions_this_week if s.subject_id == subject.id
        )
        progress.append(
            schemas.SubjectProgress(
                subject=subject,
                total_assignments=total,
                completed_assignments=completed,
                overdue_assignments=overdue,
                completion_rate=round(completed / total * 100, 1) if total else 0.0,
                hours_studied_this_week=round(minutes_this_week / 60, 1),
                topic_count=len([t for t in all_topics if t.subject_id == subject.id]),
                resource_count=len([r for r in all_resources if r.subject_id == subject.id]),
                note_count=len([n for n in all_notes if n.subject_id == subject.id]),
            )
        )
    return progress


def get_upcoming_overdue_assignments(db: Session, user_id: str):
    """Returns (upcoming, overdue) as serialized AssignmentOut lists,
    shared by the Study Hub summary and the main dashboard."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)

    subject_map = {s.id: s for s in db.query(models.Subject).filter(models.Subject.user_id == user_id).all()}
    all_assignments = (
        db.query(models.Assignment)
        .filter(models.Assignment.subject_id.in_(subject_map.keys()))
        .all()
    )
    active_assignments = [a for a in all_assignments if a.status != models.AssignmentStatus.done]

    overdue = sorted(
        [a for a in active_assignments if a.deadline and a.deadline < now],
        key=lambda a: a.deadline,
    )
    upcoming = sorted(
        [a for a in active_assignments if a.deadline and today_end <= a.deadline <= week_end],
        key=lambda a: a.deadline,
    )[:8]

    return (
        [serialize_assignment(a, subject_map.get(a.subject_id)) for a in upcoming],
        [serialize_assignment(a, subject_map.get(a.subject_id)) for a in overdue],
    )


def get_today_study_sessions(db: Session, user_id: str) -> List[schemas.StudySessionOut]:
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    sessions = (
        db.query(models.StudySession)
        .filter(
            models.StudySession.user_id == user_id,
            models.StudySession.started_at >= today_start,
            models.StudySession.started_at < today_end,
        )
        .order_by(models.StudySession.started_at.desc())
        .all()
    )
    subject_map = {s.id: s for s in db.query(models.Subject).filter(models.Subject.user_id == user_id).all()}
    return [serialize_session(s, subject_map.get(s.subject_id)) for s in sessions]


@router.get("/summary", response_model=schemas.StudyHubSummary)
def get_study_hub_summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    subjects = db.query(models.Subject).filter(models.Subject.user_id == current_user.id).order_by(models.Subject.name.asc()).all()
    upcoming_assignments, overdue_assignments = get_upcoming_overdue_assignments(db, current_user.id)

    return schemas.StudyHubSummary(
        subjects_progress=get_subjects_progress(db, current_user.id),
        upcoming_assignments=upcoming_assignments,
        overdue_assignments=overdue_assignments,
        today_study_sessions=get_today_study_sessions(db, current_user.id),
        analytics=_build_analytics(db, subjects, current_user.id),
    )


@router.get("/search", response_model=schemas.StudyHubSearchResult)
def search_study_hub(q: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    like = f"%{q}%"
    subject_map = {s.id: s for s in db.query(models.Subject).filter(models.Subject.user_id == current_user.id).all()}
    owned_subject_ids = list(subject_map.keys())

    subjects = (
        db.query(models.Subject)
        .filter(
            models.Subject.user_id == current_user.id,
            (models.Subject.name.ilike(like)) | (models.Subject.code.ilike(like)),
        )
        .limit(10)
        .all()
    )
    assignments = (
        db.query(models.Assignment)
        .filter(
            models.Assignment.subject_id.in_(owned_subject_ids),
            (models.Assignment.title.ilike(like)) | (models.Assignment.description.ilike(like)),
        )
        .limit(10)
        .all()
    )
    notes = (
        db.query(models.Note)
        .filter(
            models.Note.subject_id.in_(owned_subject_ids),
            (models.Note.title.ilike(like)) | (models.Note.content.ilike(like)),
        )
        .limit(10)
        .all()
    )
    resources = (
        db.query(models.Resource)
        .filter(models.Resource.subject_id.in_(owned_subject_ids), models.Resource.title.ilike(like))
        .limit(10)
        .all()
    )

    return schemas.StudyHubSearchResult(
        subjects=subjects,
        assignments=[serialize_assignment(a, subject_map.get(a.subject_id)) for a in assignments],
        notes=[serialize_note(n, subject_map.get(n.subject_id)) for n in notes],
        resources=[serialize_resource(r, subject_map.get(r.subject_id)) for r in resources],
    )
