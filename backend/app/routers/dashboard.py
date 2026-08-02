"""
Dashboard aggregation endpoint.

Bundles everything the dashboard page needs into a single request so the
frontend does not have to fire off five separate calls (and risk them
being out of sync with each other) every time it loads. Also folds in
Study Hub data (upcoming/overdue assignments, today's study sessions,
subject progress) so Study Hub isn't a disconnected module - it's part
of the same daily overview.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from .tasks import serialize_task
from .study_hub import get_subjects_progress, get_upcoming_overdue_assignments, get_today_study_sessions
from .projects import get_projects_progress, get_upcoming_milestones, get_overdue_project_todos, get_recent_timeline
from ..models import TimetableSlot

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=schemas.DashboardOut)
def get_dashboard(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)

    all_tasks = db.query(models.Task).all()
    active_tasks = [t for t in all_tasks if t.status != models.TaskStatus.done]

    today_tasks = [
        t for t in active_tasks
        if t.deadline and today_start <= t.deadline < today_end
    ]
    overdue_tasks = [
        t for t in active_tasks
        if t.deadline and t.deadline < now
    ]
    upcoming_deadlines = sorted(
        [
            t for t in active_tasks
            if t.deadline and today_end <= t.deadline <= week_end
        ],
        key=lambda t: t.deadline,
    )[:8]

    today_tasks.sort(key=lambda t: t.deadline)
    overdue_tasks.sort(key=lambda t: t.deadline)

    completed_tasks = [t for t in all_tasks if t.status == models.TaskStatus.done]
    completion_rate = (
        round(len(completed_tasks) / len(all_tasks) * 100, 1) if all_tasks else 0.0
    )

    slots = db.query(TimetableSlot).all()

    def slot_hours(slot: TimetableSlot) -> float:
        sh, sm = map(int, slot.start_time.split(":"))
        eh, em = map(int, slot.end_time.split(":"))
        return max((eh * 60 + em) - (sh * 60 + sm), 0) / 60.0

    hours_planned = round(sum(slot_hours(s) for s in slots), 1)

    stats = schemas.QuickStats(
        total_tasks=len(all_tasks),
        completed_tasks=len(completed_tasks),
        overdue_tasks=len(overdue_tasks),
        due_today=len(today_tasks),
        completion_rate=completion_rate,
        hours_planned_this_week=hours_planned,
    )

    recent_activity = (
        db.query(models.ActivityLog)
        .order_by(models.ActivityLog.created_at.desc())
        .limit(10)
        .all()
    )

    upcoming_assignments, overdue_assignments = get_upcoming_overdue_assignments(db)

    return schemas.DashboardOut(
        today_tasks=[serialize_task(t) for t in today_tasks],
        overdue_tasks=[serialize_task(t) for t in overdue_tasks],
        upcoming_deadlines=[serialize_task(t) for t in upcoming_deadlines],
        stats=stats,
        recent_activity=recent_activity,
        upcoming_assignments=upcoming_assignments,
        overdue_assignments=overdue_assignments,
        today_study_sessions=get_today_study_sessions(db),
        subjects_progress=get_subjects_progress(db),
        projects_progress=get_projects_progress(db)[:6],
        upcoming_milestones=get_upcoming_milestones(db),
        overdue_project_todos=get_overdue_project_todos(db),
        recent_project_timeline=get_recent_timeline(db, limit=8),
    )
