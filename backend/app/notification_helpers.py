"""
Shared helper for creating `Notification` rows (see `models.Notification`).

Kept as its own module -- not inside `routers/notifications.py` -- so any
router that needs to notify a user (invitations today; task reminders,
member changes, etc. later) can import a plain function without creating
a circular import against the notifications router itself. Mirrors how
`activity_log.py` is a shared helper imported by many routers.
"""
from typing import Optional

from sqlalchemy.orm import Session

from . import models


def create_notification(
    db: Session,
    user_id: str,
    category: models.NotificationCategory,
    title: str,
    message: str = "",
    project_id: Optional[str] = None,
    invitation_id: Optional[str] = None,
    action_url: str = "",
) -> models.Notification:
    notification = models.Notification(
        user_id=user_id,
        category=category,
        title=title,
        message=message,
        project_id=project_id,
        invitation_id=invitation_id,
        action_url=action_url,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
