"""
Project Workspace analytics: per-project and workspace-wide rollups
covering Project Progress, Todo Completion, Bug Counts, Milestone
Progress, Feature Status, and Velocity (todos/bugs/milestones completed
per week over the last 8 weeks).

Computed on the fly from the child tables on every request, same
philosophy as `study_hub._build_analytics` -- nothing here is stored.
"""
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..auth_dependencies import get_current_user, require_permission
from ..project_helpers import get_accessible_project_ids

router = APIRouter(prefix="/api/analytics", tags=["project-workspace"])

WEEKS_OF_VELOCITY = 8


def _week_start(dt: datetime) -> datetime:
    """Returns the Monday 00:00 of the week containing `dt`."""
    day_start = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return day_start - timedelta(days=day_start.weekday())


def _build_velocity(
    todos: List[models.ProjectTodo],
    bugs: List[models.Bug],
    milestones: List[models.Milestone],
) -> List[schemas.VelocityPoint]:
    now = utc_now()
    current_week_start = _week_start(now)
    window_start = current_week_start - timedelta(weeks=WEEKS_OF_VELOCITY - 1)

    buckets = {}
    for i in range(WEEKS_OF_VELOCITY):
        week = (window_start + timedelta(weeks=i)).date().isoformat()
        buckets[week] = {"todos_completed": 0, "bugs_resolved": 0, "milestones_reached": 0}

    for t in todos:
        if t.completed_at and t.completed_at >= window_start:
            key = _week_start(t.completed_at).date().isoformat()
            if key in buckets:
                buckets[key]["todos_completed"] += 1

    for b in bugs:
        if b.resolved_at and b.resolved_at >= window_start:
            key = _week_start(b.resolved_at).date().isoformat()
            if key in buckets:
                buckets[key]["bugs_resolved"] += 1

    for m in milestones:
        if m.completed_at and m.completed_at >= window_start:
            key = _week_start(m.completed_at).date().isoformat()
            if key in buckets:
                buckets[key]["milestones_reached"] += 1

    return [
        schemas.VelocityPoint(week_start=week, **counts)
        for week, counts in sorted(buckets.items())
    ]


def build_project_analytics(db: Session, project: models.Project) -> schemas.ProjectAnalytics:
    now = utc_now()

    phases = db.query(models.ProjectPhase).filter(models.ProjectPhase.project_id == project.id).all()
    features = db.query(models.Feature).filter(models.Feature.project_id == project.id).all()
    todos = db.query(models.ProjectTodo).filter(models.ProjectTodo.project_id == project.id).all()
    bugs = db.query(models.Bug).filter(models.Bug.project_id == project.id).all()
    milestones = db.query(models.Milestone).filter(models.Milestone.project_id == project.id).all()

    # ---- Project Progress ----
    completed_phases = [p for p in phases if p.status == models.PhaseStatus.completed]
    if phases:
        phase_progress = sum(p.progress or 0 for p in phases) / len(phases)
        overall_progress = round((phase_progress + (project.progress or 0)) / 2, 1)
    else:
        overall_progress = float(project.progress or 0)

    # ---- Todo Completion ----
    completed_todos = [t for t in todos if t.status == models.TaskStatus.done]
    overdue_todos = [
        t for t in todos
        if t.status != models.TaskStatus.done and t.deadline and t.deadline < now
    ]
    todo_completion_rate = round(len(completed_todos) / len(todos) * 100, 1) if todos else 0.0

    # ---- Bug Counts ----
    open_bugs = [b for b in bugs if b.status in (models.BugStatus.open, models.BugStatus.in_progress)]
    resolved_bugs = [b for b in bugs if b.status == models.BugStatus.resolved]
    bugs_by_severity = [
        schemas.BugSeverityCount(severity=sev, count=len([b for b in bugs if b.severity == sev]))
        for sev in models.BugSeverity
    ]
    bugs_by_status = [
        schemas.BugStatusCount(status=st, count=len([b for b in bugs if b.status == st]))
        for st in models.BugStatus
    ]

    # ---- Milestone Progress ----
    completed_milestones = [m for m in milestones if m.completed]
    upcoming_milestones = [
        m for m in milestones
        if not m.completed and m.target_date and m.target_date >= now
    ]
    overdue_milestones = [
        m for m in milestones
        if not m.completed and m.target_date and m.target_date < now
    ]
    milestone_completion_rate = (
        round(len(completed_milestones) / len(milestones) * 100, 1) if milestones else 0.0
    )

    # ---- Feature Status ----
    features_by_status = [
        schemas.FeatureStatusCount(status=st, count=len([f for f in features if f.status == st]))
        for st in models.FeatureStatus
    ]

    return schemas.ProjectAnalytics(
        project_id=project.id,
        project_name=project.name,
        overall_progress=overall_progress,
        phase_count=len(phases),
        completed_phase_count=len(completed_phases),
        total_todos=len(todos),
        completed_todos=len(completed_todos),
        todo_completion_rate=todo_completion_rate,
        overdue_todos=len(overdue_todos),
        total_bugs=len(bugs),
        open_bugs=len(open_bugs),
        resolved_bugs=len(resolved_bugs),
        bugs_by_severity=bugs_by_severity,
        bugs_by_status=bugs_by_status,
        total_milestones=len(milestones),
        completed_milestones=len(completed_milestones),
        milestone_completion_rate=milestone_completion_rate,
        upcoming_milestones=len(upcoming_milestones),
        overdue_milestones=len(overdue_milestones),
        total_features=len(features),
        features_by_status=features_by_status,
        velocity=_build_velocity(todos, bugs, milestones),
    )


@router.get("/projects/{project_id}", response_model=schemas.ProjectAnalytics)
def get_project_analytics(
    project_id: str,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_permission("view_tasks")),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return build_project_analytics(db, project)


@router.get("/overview", response_model=schemas.WorkspaceAnalytics)
def get_workspace_analytics(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Cross-project rollup: every accessible project's analytics plus a
    combined velocity series across just those projects (owned + member,
    same as every other cross-project endpoint)."""
    accessible_project_ids = get_accessible_project_ids(db, current_user.id)
    query = db.query(models.Project).filter(models.Project.id.in_(accessible_project_ids))
    if not include_archived:
        query = query.filter(models.Project.archived.is_(False))
    projects = query.all()

    project_analytics = [build_project_analytics(db, p) for p in projects]

    project_ids = [p.id for p in projects]
    all_todos = db.query(models.ProjectTodo).filter(models.ProjectTodo.project_id.in_(project_ids)).all()
    all_bugs = db.query(models.Bug).filter(models.Bug.project_id.in_(project_ids)).all()
    all_milestones = db.query(models.Milestone).filter(models.Milestone.project_id.in_(project_ids)).all()

    active_projects = [p for p in projects if p.status == models.ProjectStatus.active]
    completed_projects = [p for p in projects if p.status == models.ProjectStatus.completed]

    return schemas.WorkspaceAnalytics(
        total_projects=len(projects),
        active_projects=len(active_projects),
        completed_projects=len(completed_projects),
        project_analytics=project_analytics,
        combined_velocity=_build_velocity(all_todos, all_bugs, all_milestones),
    )
