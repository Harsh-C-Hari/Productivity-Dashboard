"""
CRUD for `UserPreference`, one row per `User` (app/UI-state prefs --
theme, language, timezone, dashboard layout, sidebar state, default
project, AI preferences). Split from `NotificationPreference` (see
`routers/notification_preferences.py`) per `models.UserPreference`'s
own docstring.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..auth_dependencies import get_current_user

router = APIRouter(prefix="/api/users/{user_id}/preferences", tags=["user-preferences"])


def serialize_preferences(pref: models.UserPreference) -> schemas.UserPreferenceOut:
    return schemas.UserPreferenceOut.model_validate(
        {
            "id": pref.id,
            "user_id": pref.user_id,
            "theme": pref.theme,
            "language": pref.language,
            "timezone": pref.timezone,
            "sidebar_state": pref.sidebar_state,
            "dashboard_layout": json.loads(pref.dashboard_layout or "{}"),
            "default_project_id": pref.default_project_id,
            "ai_preferences": json.loads(pref.ai_preferences or "{}"),
            "created_at": pref.created_at,
            "updated_at": pref.updated_at,
        }
    )


def _get_user_or_404(db: Session, user_id: str) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_or_create_preferences(db: Session, user_id: str) -> models.UserPreference:
    """Every User implicitly has preferences -- rather than requiring a
    separate explicit-create step, GET auto-creates the row with column
    defaults on first access, the same "always exists, lazily
    materialized" shape as `NotificationPreference` below."""
    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == user_id).first()
    if not pref:
        pref = models.UserPreference(user_id=user_id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


def _require_self(user_id: str, current_user: models.User) -> None:
    # Preferences are personal (see module docstring); previously this
    # whole router had no auth dependency at all, so any user_id in the
    # path -- including someone else's -- worked. 404, not 403: whether
    # another user's preferences row exists is not this endpoint's to
    # confirm, same rationale as `ownership_helpers.require_owner_id`.
    if user_id != current_user.id:
        raise HTTPException(status_code=404, detail="User not found")


@router.get("", response_model=schemas.UserPreferenceOut)
def get_preferences(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _require_self(user_id, current_user)
    _get_user_or_404(db, user_id)
    return serialize_preferences(get_or_create_preferences(db, user_id))


@router.patch("", response_model=schemas.UserPreferenceOut)
def update_preferences(user_id: str, payload: schemas.UserPreferenceUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _require_self(user_id, current_user)
    _get_user_or_404(db, user_id)
    if payload.default_project_id:
        project = db.query(models.Project).filter(models.Project.id == payload.default_project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="default_project_id does not match an existing project")

    pref = get_or_create_preferences(db, user_id)
    data = payload.model_dump(exclude_unset=True)

    if "dashboard_layout" in data:
        pref.dashboard_layout = json.dumps(data.pop("dashboard_layout") or {})
    if "ai_preferences" in data:
        pref.ai_preferences = json.dumps(data.pop("ai_preferences") or {})

    for field, value in data.items():
        setattr(pref, field, value)

    import datetime as _dt
    pref.updated_at = _dt.utc_now()
    db.commit()
    db.refresh(pref)
    return serialize_preferences(pref)
