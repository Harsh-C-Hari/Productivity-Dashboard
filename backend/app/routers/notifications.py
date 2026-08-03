"""
Notification Center backend: CRUD/read-state API for `models.Notification`
(see AI_HANDOFF.md "Notification Center"). Every endpoint is scoped to the
authenticated caller -- a user only ever sees/mutates their own
notifications, via `auth_dependencies.get_current_user`, the same
dependency `routers/auth.py`'s `/me` uses.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..auth_dependencies import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def serialize_notification(notification: models.Notification) -> schemas.NotificationOut:
    return schemas.NotificationOut.model_validate(notification)


def _get_owned_notification_or_404(db: Session, user: models.User, notification_id: str) -> models.Notification:
    notification = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.user_id == user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.get("", response_model=List[schemas.NotificationOut])
def list_notifications(
    is_read: Optional[bool] = None,
    category: Optional[models.NotificationCategory] = None,
    search: Optional[str] = Query(default=None, description="Matches title or message"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Notification).filter(models.Notification.user_id == current_user.id)
    if is_read is not None:
        query = query.filter(models.Notification.is_read == is_read)
    if category:
        query = query.filter(models.Notification.category == category)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(models.Notification.title.ilike(like), models.Notification.message.ilike(like)))
    query = query.order_by(models.Notification.created_at.desc()).offset(offset).limit(limit)
    return [serialize_notification(n) for n in query.all()]


@router.get("/counts", response_model=schemas.NotificationCounts)
def get_notification_counts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    base = db.query(models.Notification).filter(models.Notification.user_id == current_user.id)
    unread = base.filter(models.Notification.is_read.is_(False)).count()
    total = base.count()
    pending_invitations = base.filter(
        models.Notification.category == models.NotificationCategory.project_invitation,
        models.Notification.is_read.is_(False),
    ).count()
    return schemas.NotificationCounts(unread=unread, total=total, pending_invitations=pending_invitations)


@router.get("/{notification_id}", response_model=schemas.NotificationOut)
def get_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return serialize_notification(_get_owned_notification_or_404(db, current_user, notification_id))


@router.post("/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notification = _get_owned_notification_or_404(db, current_user, notification_id)
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = utc_now()
        db.commit()
        db.refresh(notification)
    return serialize_notification(notification)


@router.post("/{notification_id}/unread", response_model=schemas.NotificationOut)
def mark_unread(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notification = _get_owned_notification_or_404(db, current_user, notification_id)
    if notification.is_read:
        notification.is_read = False
        notification.read_at = None
        db.commit()
        db.refresh(notification)
    return serialize_notification(notification)


@router.post("/mark-all-read", response_model=schemas.NotificationCounts)
def mark_all_read(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    now = utc_now()
    (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id, models.Notification.is_read.is_(False))
        .update({"is_read": True, "read_at": now}, synchronize_session=False)
    )
    db.commit()
    return get_notification_counts(db=db, current_user=current_user)


@router.delete("/{notification_id}", status_code=204)
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notification = _get_owned_notification_or_404(db, current_user, notification_id)
    db.delete(notification)
    db.commit()
    return None
