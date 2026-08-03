"""
CRUD endpoints for Project Todos (fine-grained, project-scoped task
items -- the Project Workspace analogue of Task/Assignment). Every
response passes through `serialize_todo`, which computes urgency via
the existing Smart Urgency Engine, exactly like `tasks.serialize_task`
and `assignments.serialize_assignment`.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..urgency import compute_urgency
from ..activity_log import log_activity
from ..project_helpers import log_timeline_event
from ..auth_dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/todos", tags=["project-workspace"])


def serialize_todo(
    todo: models.ProjectTodo,
    phase: Optional[models.ProjectPhase] = None,
    feature: Optional[models.Feature] = None,
) -> schemas.ProjectTodoOut:
    urgency = compute_urgency(
        deadline=todo.deadline,
        estimated_effort_hours=todo.estimated_effort_hours or 0,
        progress=todo.progress or 0,
        status=todo.status.value if hasattr(todo.status, "value") else todo.status,
    )
    out = schemas.ProjectTodoOut.model_validate(todo)
    out.urgency = urgency
    if phase:
        out.phase_title = phase.title
    if feature:
        out.feature_title = feature.title
    return out


def get_todo_or_404(db: Session, todo_id: str) -> models.ProjectTodo:
    todo = db.query(models.ProjectTodo).filter(models.ProjectTodo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


def _phase_map(db: Session) -> dict:
    return {p.id: p for p in db.query(models.ProjectPhase).all()}


def _feature_map(db: Session) -> dict:
    return {f.id: f for f in db.query(models.Feature).all()}


@router.get("", response_model=List[schemas.ProjectTodoOut])
def list_todos(
    project_id: str = Query(..., description="Only todos on this project are ever returned; required so this can never list another project's items."),
    phase_id: Optional[str] = None,
    feature_id: Optional[str] = None,
    status: Optional[models.TaskStatus] = None,
    q: Optional[str] = None,
    overdue_only: bool = False,
    sort_by: str = Query(default="deadline", pattern="^(deadline|created_at|updated_at|progress|title)$"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, current_user, project_id, "view_tasks")
    query = db.query(models.ProjectTodo).filter(models.ProjectTodo.project_id == project_id)
    if phase_id:
        query = query.filter(models.ProjectTodo.phase_id == phase_id)
    if feature_id:
        query = query.filter(models.ProjectTodo.feature_id == feature_id)
    if status:
        query = query.filter(models.ProjectTodo.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(models.ProjectTodo.title.ilike(like), models.ProjectTodo.description.ilike(like)))
    if overdue_only:
        query = query.filter(
            models.ProjectTodo.status != models.TaskStatus.done,
            models.ProjectTodo.deadline.isnot(None),
            models.ProjectTodo.deadline < utc_now(),
        )

    if sort_by == "deadline":
        # Nulls-last so undated todos don't dominate the top of the list.
        query = query.order_by(models.ProjectTodo.deadline.is_(None), models.ProjectTodo.deadline.asc())
    else:
        sort_column = getattr(models.ProjectTodo, sort_by)
        sort_column = sort_column.desc() if sort_order == "desc" else sort_column.asc()
        query = query.order_by(sort_column)

    if limit is not None:
        query = query.offset(offset).limit(limit)

    todos = query.all()
    phases = _phase_map(db)
    features = _feature_map(db)
    return [serialize_todo(t, phases.get(t.phase_id), features.get(t.feature_id)) for t in todos]


@router.get("/{todo_id}", response_model=schemas.ProjectTodoOut)
def get_todo(todo_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    todo = get_todo_or_404(db, todo_id)
    require_project_access(db, current_user, todo.project_id, "view_tasks")
    phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == todo.phase_id).first() if todo.phase_id else None
    feature = db.query(models.Feature).filter(models.Feature.id == todo.feature_id).first() if todo.feature_id else None
    return serialize_todo(todo, phase, feature)


@router.post("", response_model=schemas.ProjectTodoOut, status_code=201)
def create_todo(payload: schemas.ProjectTodoCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_project_access(db, current_user, payload.project_id, "manage_tasks")
    phase = None
    if payload.phase_id:
        phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == payload.phase_id).first()
        if not phase:
            raise HTTPException(status_code=404, detail="Phase not found")
    feature = None
    if payload.feature_id:
        feature = db.query(models.Feature).filter(models.Feature.id == payload.feature_id).first()
        if not feature:
            raise HTTPException(status_code=404, detail="Feature not found")

    todo = models.ProjectTodo(**payload.model_dump())
    db.add(todo)
    db.commit()
    db.refresh(todo)
    log_activity(db, f'Added todo "{todo.title}" to {project.name}', icon="plus-circle")
    return serialize_todo(todo, phase, feature)


@router.patch("/{todo_id}", response_model=schemas.ProjectTodoOut)
def update_todo(todo_id: str, payload: schemas.ProjectTodoUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    todo = get_todo_or_404(db, todo_id)
    require_project_access(db, current_user, todo.project_id, "manage_tasks")

    data = payload.model_dump(exclude_unset=True)
    clear_deadline = data.pop("clear_deadline", False)
    clear_phase = data.pop("clear_phase", False)
    clear_feature = data.pop("clear_feature", False)

    if data.get("phase_id"):
        if not db.query(models.ProjectPhase).filter(models.ProjectPhase.id == data["phase_id"]).first():
            raise HTTPException(status_code=404, detail="Phase not found")
    if data.get("feature_id"):
        if not db.query(models.Feature).filter(models.Feature.id == data["feature_id"]).first():
            raise HTTPException(status_code=404, detail="Feature not found")

    was_done = todo.status == models.TaskStatus.done

    for field, value in data.items():
        setattr(todo, field, value)
    if clear_deadline:
        todo.deadline = None
    if clear_phase:
        todo.phase_id = None
    if clear_feature:
        todo.feature_id = None

    if todo.status == models.TaskStatus.done:
        todo.progress = 100
        if not was_done:
            todo.completed_at = utc_now()
    elif was_done and todo.status != models.TaskStatus.done:
        todo.completed_at = None

    if todo.progress == 100 and todo.status != models.TaskStatus.done:
        todo.status = models.TaskStatus.done
        todo.completed_at = utc_now()

    todo.updated_at = utc_now()
    db.commit()
    db.refresh(todo)

    phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.id == todo.phase_id).first() if todo.phase_id else None
    feature = db.query(models.Feature).filter(models.Feature.id == todo.feature_id).first() if todo.feature_id else None

    if todo.status == models.TaskStatus.done and not was_done:
        log_activity(db, f'Completed todo "{todo.title}"', icon="check-circle")
        log_timeline_event(
            db, todo.project_id, "todo_completed", f'Todo "{todo.title}" completed',
            related_entity_type="todo", related_entity_id=todo.id, icon="check-circle",
        )
    else:
        log_activity(db, f'Updated todo "{todo.title}"', icon="pencil")

    return serialize_todo(todo, phase, feature)


@router.delete("/{todo_id}", status_code=204)
def delete_todo(todo_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    todo = get_todo_or_404(db, todo_id)
    require_project_access(db, current_user, todo.project_id, "manage_tasks")
    title = todo.title
    db.delete(todo)
    db.commit()
    log_activity(db, f'Deleted todo "{title}"', icon="trash-2")
    return None
