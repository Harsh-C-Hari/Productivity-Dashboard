"""
Shared "Recent Activity" logging helper.

`routers/tasks.py` defines its own local copy of this exact function; it's
duplicated here (rather than imported from there) so the original task
router is left untouched. Every Study Hub router uses this shared copy.
"""
from typing import Optional

from sqlalchemy.orm import Session

from . import models


def log_activity(db: Session, message: str, icon: str = "activity"):
    entry = models.ActivityLog(message=message, icon=icon)
    db.add(entry)
    db.commit()


def log_activity_event(
    db: Session,
    message: str,
    icon: str = "activity",
    user_id: Optional[str] = None,
    project_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> models.ActivityLog:
    """Collaboration-aware sibling of `log_activity` above, writing the
    `user_id`/`project_id`/`action`/`entity_type`/`entity_id` columns
    added to `ActivityLog` for collaboration/audit (see models.py). Kept
    as a separate function -- rather than adding these as optional
    keyword args to `log_activity` itself -- so every existing call site
    across the app keeps working unchanged, and so the two call shapes
    stay easy to tell apart at a glance: plain `log_activity(db, msg)`
    for the pre-existing "Recent Activity" feed, `log_activity_event`
    wherever a collaboration router wants the entry attributable to a
    user/project/entity for future filtering (`routers/activity.py`).
    """
    entry = models.ActivityLog(
        message=message,
        icon=icon,
        user_id=user_id,
        project_id=project_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
