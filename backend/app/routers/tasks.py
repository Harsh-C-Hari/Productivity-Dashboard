"""
CRUD endpoints for tasks, plus urgency injection.

Every response passes through `serialize_task`, which computes the
task's current urgency tier on the fly (rather than storing it),
so urgency is always fresh relative to "now" even if the task record
hasn't been touched recently.

Personal module: every Task belongs to the current user via
`Task.user_id`.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..urgency import compute_urgency
from ..auth_dependencies import get_current_user
from ..ownership_helpers import get_owned_or_404, owned_query
# Instant background alerts: pushing a just-created/just-changed deadline
# immediately instead of waiting up to five minutes for the /api/push/dispatch
# uptime ping (see routers/push.py).
from .push import dispatch_for_user_now

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def serialize_task(task: models.Task) -> schemas.TaskOut:
    urgency = compute_urgency(
        deadline=task.deadline,
        estimated_effort_hours=task.estimated_effort_hours or 0,
        progress=task.progress or 0,
        status=task.status.value if hasattr(task.status, "value") else task.status,
    )
    out = schemas.TaskOut.model_validate(task)
    out.urgency = urgency
    return out


def log_activity(db: Session, message: str, icon: str = "activity", user_id: Optional[str] = None):
    entry = models.ActivityLog(message=message, icon=icon, user_id=user_id)
    db.add(entry)
    db.commit()


@router.get("", response_model=List[schemas.TaskOut])
def list_tasks(
    status: Optional[models.TaskStatus] = None,
    category: Optional[models.TaskCategory] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = owned_query(db, models.Task, current_user.id)
    if status:
        query = query.filter(models.Task.status == status)
    if category:
        query = query.filter(models.Task.category == category)
    tasks = query.order_by(models.Task.deadline.is_(None), models.Task.deadline.asc()).all()
    return [serialize_task(t) for t in tasks]


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task = get_owned_or_404(db, models.Task, task_id, current_user.id, "Task not found")
    return serialize_task(task)


@router.post("", response_model=schemas.TaskOut, status_code=201)
def create_task(
    payload: schemas.TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    task = models.Task(**payload.model_dump(), user_id=current_user.id)
    db.add(task)
    db.commit()
    db.refresh(task)
    log_activity(db, f'Created task "{task.title}"', icon="plus-circle", user_id=current_user.id)
    # If the new deadline is already inside the alert windows, push it to
    # every device now rather than on the next uptime ping. Fire-and-forget.
    dispatch_for_user_now(db, current_user.id, task_ids=[task.id])
    return serialize_task(task)


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: str,
    payload: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = get_owned_or_404(db, models.Task, task_id, current_user.id, "Task not found")

    data = payload.model_dump(exclude_unset=True)
    clear_deadline = data.pop("clear_deadline", False)

    was_done = task.status == models.TaskStatus.done

    for field, value in data.items():
        setattr(task, field, value)

    if clear_deadline:
        task.deadline = None

    # Keep progress and status in sync in sensible ways.
    if task.status == models.TaskStatus.done:
        task.progress = 100
        if not was_done:
            task.completed_at = utc_now()
    elif was_done and task.status != models.TaskStatus.done:
        task.completed_at = None

    if task.progress == 100 and task.status != models.TaskStatus.done:
        task.status = models.TaskStatus.done
        task.completed_at = utc_now()

    task.updated_at = utc_now()
    db.commit()
    db.refresh(task)

    if task.status == models.TaskStatus.done and not was_done:
        log_activity(db, f'Completed "{task.title}"', icon="check-circle", user_id=current_user.id)
    else:
        log_activity(db, f'Updated "{task.title}"', icon="pencil", user_id=current_user.id)

    # Deadline moved into (or out of) the alert windows -- re-check this
    # task's alert state instantly. Fire-and-forget; never fails the PATCH.
    dispatch_for_user_now(db, current_user.id, task_ids=[task.id])

    return serialize_task(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    task = get_owned_or_404(db, models.Task, task_id, current_user.id, "Task not found")
    title = task.title
    db.delete(task)
    db.commit()
    log_activity(db, f'Deleted "{title}"', icon="trash-2", user_id=current_user.id)
    return None
