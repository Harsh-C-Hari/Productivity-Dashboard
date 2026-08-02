"""
CRUD endpoints for Projects, the top-level container for the Project
Workspace. Mirrors `routers/subjects.py` (the Study Hub's own top-level
entity) closely: simple CRUD plus a cleanup-on-delete step, since
SQLAlchemy's ORM-level cascade (see `models.Project`) handles removing
child rows but not the files those child ProjectResources reference on
disk.

Also hosts the per-project rollup (`/summary`) and the cross-entity
Project Workspace search (`/search`) endpoints, the same role
`routers/subjects.py` + `routers/study_hub.py` play together for the
Study Hub.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..uploads import delete_upload
from ..project_helpers import log_timeline_event, get_accessible_project_ids, is_owner
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/projects", tags=["project-workspace"])


# ---------- Serialization ----------

def serialize_project(project: models.Project) -> schemas.ProjectOut:
    return schemas.ProjectOut.model_validate(
        {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "icon": project.icon,
            "color": project.color,
            "status": project.status,
            "repository_url": project.repository_url,
            "local_repository": project.local_repository,
            "progress": project.progress,
            "archived": project.archived,
            "tags": json.loads(project.tags or "[]"),
            "owner_id": project.owner_id,
            "visibility": project.visibility,
            "collaboration_enabled": project.collaboration_enabled,
            "project_type": project.project_type,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
        }
    )


def get_project_or_404(db: Session, project_id: str) -> models.Project:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def build_project_summary(db: Session, project: models.Project) -> schemas.ProjectSummary:
    """Per-project rollup used by `/summary` and the dashboard's
    Project Workspace widget. Computed on the fly, same philosophy as
    `study_hub.get_subjects_progress`."""
    phases = db.query(models.ProjectPhase).filter(models.ProjectPhase.project_id == project.id).all()
    features = db.query(models.Feature).filter(models.Feature.project_id == project.id).all()
    todos = db.query(models.ProjectTodo).filter(models.ProjectTodo.project_id == project.id).all()
    bugs = db.query(models.Bug).filter(models.Bug.project_id == project.id).all()
    milestones = db.query(models.Milestone).filter(models.Milestone.project_id == project.id).all()
    resources = db.query(models.ProjectResource).filter(models.ProjectResource.project_id == project.id).all()
    documents = db.query(models.ProjectDocument).filter(models.ProjectDocument.project_id == project.id).all()

    completed_todos = [t for t in todos if t.status == models.TaskStatus.done]
    open_bugs = [b for b in bugs if b.status in (models.BugStatus.open, models.BugStatus.in_progress)]
    completed_milestones = [m for m in milestones if m.completed]

    # Overall progress blends the project's own progress field with the
    # rollup of its phases (when it has any), so a project with no
    # phases still shows a sensible number.
    if phases:
        phase_progress = sum(p.progress or 0 for p in phases) / len(phases)
        overall_progress = round((phase_progress + (project.progress or 0)) / 2, 1)
    else:
        overall_progress = float(project.progress or 0)

    return schemas.ProjectSummary(
        project=serialize_project(project),
        phase_count=len(phases),
        feature_count=len(features),
        todo_count=len(todos),
        completed_todo_count=len(completed_todos),
        bug_count=len(bugs),
        open_bug_count=len(open_bugs),
        milestone_count=len(milestones),
        completed_milestone_count=len(completed_milestones),
        resource_count=len(resources),
        document_count=len(documents),
        overall_progress=overall_progress,
    )


# ---------- Cross-project helpers (shared with dashboard.py / analytics.py) ----------

def get_projects_progress(db: Session, include_archived: bool = False) -> List[schemas.ProjectSummary]:
    query = db.query(models.Project)
    if not include_archived:
        query = query.filter(models.Project.archived.is_(False))
    projects = query.order_by(models.Project.updated_at.desc()).all()
    return [build_project_summary(db, p) for p in projects]


def get_upcoming_milestones(db: Session, limit: int = 8) -> List[schemas.MilestoneOut]:
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    week_end = now + timedelta(days=14)
    phase_map = {p.id: p for p in db.query(models.ProjectPhase).all()}

    milestones = (
        db.query(models.Milestone)
        .filter(
            models.Milestone.completed.is_(False),
            models.Milestone.target_date.isnot(None),
            models.Milestone.target_date <= week_end,
        )
        .order_by(models.Milestone.target_date.asc())
        .limit(limit)
        .all()
    )

    out = []
    for m in milestones:
        item = schemas.MilestoneOut.model_validate(m)
        phase = phase_map.get(m.phase_id)
        if phase:
            item.phase_title = phase.title
        out.append(item)
    return out


def get_overdue_project_todos(db: Session, limit: int = 8) -> List[schemas.ProjectTodoOut]:
    from datetime import datetime

    now = datetime.utcnow()
    feature_map = {f.id: f for f in db.query(models.Feature).all()}
    phase_map = {p.id: p for p in db.query(models.ProjectPhase).all()}

    todos = (
        db.query(models.ProjectTodo)
        .filter(
            models.ProjectTodo.status != models.TaskStatus.done,
            models.ProjectTodo.deadline.isnot(None),
            models.ProjectTodo.deadline < now,
        )
        .order_by(models.ProjectTodo.deadline.asc())
        .limit(limit)
        .all()
    )

    from ..urgency import compute_urgency

    out = []
    for t in todos:
        item = schemas.ProjectTodoOut.model_validate(t)
        item.urgency = compute_urgency(
            deadline=t.deadline,
            estimated_effort_hours=t.estimated_effort_hours or 0,
            progress=t.progress or 0,
            status=t.status.value if hasattr(t.status, "value") else t.status,
        )
        feature = feature_map.get(t.feature_id)
        phase = phase_map.get(t.phase_id)
        if feature:
            item.feature_title = feature.title
        if phase:
            item.phase_title = phase.title
        out.append(item)
    return out


def get_recent_timeline(db: Session, limit: int = 10) -> List[schemas.TimelineEventOut]:
    events = (
        db.query(models.TimelineEvent)
        .order_by(models.TimelineEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [schemas.TimelineEventOut.model_validate(e) for e in events]


# ---------- Static-path routes (must be registered before /{project_id}) ----------

@router.get("/summary", response_model=schemas.ProjectWorkspaceSummary)
def get_workspace_summary(
    include_archived: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Top-level Project Workspace rollup: per-project progress plus
    upcoming milestones, overdue todos, and recent timeline activity
    across every project this user can see. Same role as
    `study_hub.get_study_hub_summary` (that module has no per-user
    scoping concept since Study Hub was never made collaborative)."""
    accessible_project_ids = set(get_accessible_project_ids(db, current_user.id))
    projects_progress = [
        p for p in get_projects_progress(db, include_archived=include_archived)
        if p.project.id in accessible_project_ids
    ]
    return schemas.ProjectWorkspaceSummary(
        projects_progress=projects_progress,
        upcoming_milestones=[m for m in get_upcoming_milestones(db)],
        overdue_todos=[t for t in get_overdue_project_todos(db)],
        recent_timeline=get_recent_timeline(db),
    )


@router.get("/search", response_model=schemas.ProjectWorkspaceSearchResult)
def search_projects(
    q: str,
    project_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cross-entity search spanning Projects, Todos, Features, Bugs,
    Documentation, and Resources -- the Project Workspace's contribution
    to the "every module exposes searchable entities" rule, mirroring
    `study_hub.search_study_hub`."""
    like = f"%{q}%"

    projects_query = db.query(models.Project).filter(
        or_(models.Project.name.ilike(like), models.Project.description.ilike(like))
    )
    todos_query = db.query(models.ProjectTodo).filter(
        or_(models.ProjectTodo.title.ilike(like), models.ProjectTodo.description.ilike(like))
    )
    features_query = db.query(models.Feature).filter(
        or_(models.Feature.title.ilike(like), models.Feature.description.ilike(like))
    )
    bugs_query = db.query(models.Bug).filter(
        or_(models.Bug.title.ilike(like), models.Bug.description.ilike(like))
    )
    documents_query = db.query(models.ProjectDocument).filter(
        or_(models.ProjectDocument.title.ilike(like), models.ProjectDocument.content.ilike(like))
    )
    resources_query = db.query(models.ProjectResource).filter(models.ProjectResource.title.ilike(like))

    accessible_project_ids = get_accessible_project_ids(db, current_user.id)
    projects_query = projects_query.filter(models.Project.id.in_(accessible_project_ids))
    todos_query = todos_query.filter(models.ProjectTodo.project_id.in_(accessible_project_ids))
    features_query = features_query.filter(models.Feature.project_id.in_(accessible_project_ids))
    bugs_query = bugs_query.filter(models.Bug.project_id.in_(accessible_project_ids))
    documents_query = documents_query.filter(models.ProjectDocument.project_id.in_(accessible_project_ids))
    resources_query = resources_query.filter(models.ProjectResource.project_id.in_(accessible_project_ids))

    if project_id:
        projects_query = projects_query.filter(models.Project.id == project_id)
        todos_query = todos_query.filter(models.ProjectTodo.project_id == project_id)
        features_query = features_query.filter(models.Feature.project_id == project_id)
        bugs_query = bugs_query.filter(models.Bug.project_id == project_id)
        documents_query = documents_query.filter(models.ProjectDocument.project_id == project_id)
        resources_query = resources_query.filter(models.ProjectResource.project_id == project_id)

    from .todos import serialize_todo
    from .features import serialize_feature
    from .bugs import serialize_bug

    phase_map = {p.id: p for p in db.query(models.ProjectPhase).all()}
    feature_map = {f.id: f for f in db.query(models.Feature).all()}

    return schemas.ProjectWorkspaceSearchResult(
        projects=[serialize_project(p) for p in projects_query.limit(10).all()],
        todos=[serialize_todo(t, phase_map.get(t.phase_id), feature_map.get(t.feature_id)) for t in todos_query.limit(10).all()],
        features=[serialize_feature(f, phase_map.get(f.phase_id)) for f in features_query.limit(10).all()],
        bugs=[serialize_bug(b, phase_map.get(b.phase_id), feature_map.get(b.feature_id)) for b in bugs_query.limit(10).all()],
        documents=[schemas.ProjectDocumentOut.model_validate(d) for d in documents_query.limit(10).all()],
        resources=[schemas.ProjectResourceOut.model_validate(r) for r in resources_query.limit(10).all()],
    )


# ---------- CRUD ----------

@router.get("", response_model=List[schemas.ProjectOut])
def list_projects(
    status: Optional[models.ProjectStatus] = None,
    archived: Optional[bool] = None,
    q: Optional[str] = None,
    tag: Optional[str] = None,
    sort_by: str = Query(default="updated_at", pattern="^(name|created_at|updated_at|progress)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    accessible_project_ids = get_accessible_project_ids(db, current_user.id)
    query = db.query(models.Project).filter(models.Project.id.in_(accessible_project_ids))
    if status:
        query = query.filter(models.Project.status == status)
    if archived is not None:
        query = query.filter(models.Project.archived == archived)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(models.Project.name.ilike(like), models.Project.description.ilike(like)))
    if tag:
        # tags is JSON-encoded text; a simple substring match is enough
        # for a personal, single-user tag list (no need for a join table).
        query = query.filter(models.Project.tags.ilike(f'%"{tag}"%'))

    sort_column = getattr(models.Project, sort_by)
    sort_column = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    query = query.order_by(sort_column)

    if limit is not None:
        query = query.offset(offset).limit(limit)

    return [serialize_project(p) for p in query.all()]


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)
    require_project_access(db, current_user, project_id, "view_project")
    return serialize_project(project)


@router.get("/{project_id}/summary", response_model=schemas.ProjectSummary)
def get_project_summary(project_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)
    require_project_access(db, current_user, project_id, "view_project")
    return build_project_summary(db, project)


@router.post("", response_model=schemas.ProjectOut, status_code=201)
def create_project(payload: schemas.ProjectCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = payload.model_dump()
    tags = data.pop("tags", [])
    # owner_id is accepted on the wire for read purposes (ProjectBase is
    # shared by ProjectOut), but it must never be client-settable here --
    # the creator is always the owner. Ownership can only move afterwards
    # through project_members.transfer_ownership's dedicated, audited flow.
    data.pop("owner_id", None)
    project = models.Project(**data, tags=json.dumps(tags), owner_id=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    log_activity(db, f'Created project "{project.name}"', icon="folder-plus")
    log_timeline_event(
        db, project.id, "project_created", f'Project "{project.name}" created', icon="folder-plus"
    )
    return serialize_project(project)


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: str, payload: schemas.ProjectUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)
    require_project_access(db, current_user, project_id, "manage_project")

    data = payload.model_dump(exclude_unset=True)
    # Same rule as create_project: ownership never moves through the
    # generic update path, only through project_members.transfer_ownership.
    data.pop("owner_id", None)
    was_archived = project.archived
    was_completed = project.status == models.ProjectStatus.completed

    if "tags" in data:
        project.tags = json.dumps(data.pop("tags") or [])
    for field, value in data.items():
        setattr(project, field, value)

    project.updated_at = __import__("datetime").datetime.utcnow()
    db.commit()
    db.refresh(project)

    if project.archived and not was_archived:
        log_activity(db, f'Archived project "{project.name}"', icon="archive")
    elif project.status == models.ProjectStatus.completed and not was_completed:
        log_activity(db, f'Completed project "{project.name}"', icon="check-circle")
        log_timeline_event(
            db, project.id, "project_completed", f'Project "{project.name}" marked complete', icon="check-circle"
        )
    else:
        log_activity(db, f'Updated project "{project.name}"', icon="pencil")

    return serialize_project(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Deleting a project cascades to every child table at the ORM level
    (see `models.Project` relationships). Uploaded files referenced by
    the project's ProjectResources are not touched by that cascade, so
    they're cleaned up explicitly here first, same pattern as
    `subjects.delete_subject`."""
    project = get_project_or_404(db, project_id)
    if not is_owner(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only the project owner can delete this project")
    name = project.name

    for resource in db.query(models.ProjectResource).filter(models.ProjectResource.project_id == project_id).all():
        if resource.file_name:
            delete_upload(resource.file_name)

    db.delete(project)
    db.commit()
    log_activity(db, f'Deleted project "{name}"', icon="trash-2")
    return None
