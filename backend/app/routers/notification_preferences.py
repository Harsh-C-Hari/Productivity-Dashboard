"""
CRUD for `NotificationPreference`, one row per `User` -- the user's
opt-in/opt-out choices for the app's existing notification system (see
`models.NotificationPreference`'s docstring: this reuses the existing
pipeline, it does not add a second one).
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/users/{user_id}/notification-preferences", tags=["notification-preferences"])


def serialize_preferences(pref: models.NotificationPreference) -> schemas.NotificationPreferenceOut:
    return schemas.NotificationPreferenceOut.model_validate(
        {
            "id": pref.id,
            "user_id": pref.user_id,
            "browser_notifications": pref.browser_notifications,
            "email_notifications": pref.email_notifications,
            "task_notifications": pref.task_notifications,
            "project_notifications": pref.project_notifications,
            "ai_notifications": pref.ai_notifications,
            "reminder_preferences": json.loads(pref.reminder_preferences or "{}"),
            "created_at": pref.created_at,
            "updated_at": pref.updated_at,
        }
    )


def _get_user_or_404(db: Session, user_id: str) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_or_create_preferences(db: Session, user_id: str) -> models.NotificationPreference:
    pref = db.query(models.NotificationPreference).filter(models.NotificationPreference.user_id == user_id).first()
    if not pref:
        pref = models.NotificationPreference(user_id=user_id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


@router.get("", response_model=schemas.NotificationPreferenceOut)
def get_preferences(user_id: str, db: Session = Depends(get_db)):
    _get_user_or_404(db, user_id)
    return serialize_preferences(get_or_create_preferences(db, user_id))


@router.patch("", response_model=schemas.NotificationPreferenceOut)
def update_preferences(user_id: str, payload: schemas.NotificationPreferenceUpdate, db: Session = Depends(get_db)):
    _get_user_or_404(db, user_id)
    pref = get_or_create_preferences(db, user_id)
    data = payload.model_dump(exclude_unset=True)

    if "reminder_preferences" in data:
        pref.reminder_preferences = json.dumps(data.pop("reminder_preferences") or {})

    for field, value in data.items():
        setattr(pref, field, value)

    import datetime as _dt
    pref.updated_at = _dt.datetime.utcnow()
    db.commit()
    db.refresh(pref)
    return serialize_preferences(pref)
