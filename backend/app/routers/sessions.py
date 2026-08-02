"""
Session management: list a User's active login sessions (devices),
revoke one or all of them. Split out from `routers/auth.py` (which owns
login/logout/register/tokens) per ENGINEERING_GUIDELINES.md "Router
Rules" -- one router, one responsibility.

Every endpoint here is scoped to "sessions belonging to the current
authenticated User" -- there is no admin/cross-user session listing in
this session, matching the task brief's "Do NOT implement" list (no
admin console was requested).
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from .. import models, schemas
from ..activity_log import log_activity_event
from ..auth_dependencies import get_current_user, get_current_user_and_session
from ..database import get_db

router = APIRouter(prefix="/api/auth/sessions", tags=["sessions"])


def _serialize(session: models.Session, current_session_id: str) -> schemas.SessionWithCurrentOut:
    return schemas.SessionWithCurrentOut(
        id=session.id,
        user_id=session.user_id,
        device=session.device,
        platform=session.platform,
        browser=session.browser,
        ip_address=session.ip_address,
        expires_at=session.expires_at,
        created_at=session.created_at,
        last_active_at=session.last_active_at,
        revoked=session.revoked,
        is_current=session.id == current_session_id,
    )


@router.get("", response_model=List[schemas.SessionWithCurrentOut])
def list_sessions(
    include_revoked: bool = False,
    user_and_session: tuple = Depends(get_current_user_and_session),
    db: DBSession = Depends(get_db),
):
    current_user, current_session = user_and_session
    query = db.query(models.Session).filter(models.Session.user_id == current_user.id)
    if not include_revoked:
        query = query.filter(models.Session.revoked.is_(False))
    sessions = query.order_by(models.Session.last_active_at.desc().nulls_last(), models.Session.created_at.desc()).all()
    return [_serialize(s, current_session.id) for s in sessions]


@router.get("/current", response_model=schemas.SessionWithCurrentOut)
def get_current_session(user_and_session: tuple = Depends(get_current_user_and_session)):
    _current_user, current_session = user_and_session
    current_session.last_active_at = datetime.utcnow()
    return _serialize(current_session, current_session.id)


@router.delete("/{session_id}", status_code=204)
def revoke_session(
    session_id: str,
    user_and_session: tuple = Depends(get_current_user_and_session),
    db: DBSession = Depends(get_db),
):
    """Revoke one of the current User's own sessions (e.g. "log out that
    other browser tab"). Scoped to `user_id == current_user.id` so one
    user can never revoke another user's session by guessing an id."""
    current_user, _current_session = user_and_session
    session = (
        db.query(models.Session)
        .filter(models.Session.id == session_id, models.Session.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.revoked = True
    db.commit()

    log_activity_event(
        db,
        f"{current_user.display_name or current_user.username} revoked a session",
        icon="shield-off",
        user_id=current_user.id,
        action="session_revoked",
        entity_type="session",
        entity_id=session.id,
    )
    return None


@router.post("/revoke-others", status_code=204)
def revoke_other_sessions(
    user_and_session: tuple = Depends(get_current_user_and_session),
    db: DBSession = Depends(get_db),
):
    """Revoke every session for the current User except the one making
    this request -- "log out all other devices," keeping the caller
    signed in."""
    current_user, current_session = user_and_session
    db.query(models.Session).filter(
        models.Session.user_id == current_user.id,
        models.Session.id != current_session.id,
        models.Session.revoked.is_(False),
    ).update({"revoked": True})
    db.commit()

    log_activity_event(
        db,
        f"{current_user.display_name or current_user.username} signed out all other devices",
        icon="shield-off",
        user_id=current_user.id,
        action="session_revoked",
        entity_type="session",
        entity_id=current_session.id,
    )
    return None


@router.post("/logout-all", status_code=204)
def logout_all_devices(
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Revoke every session for the current User, including the one
    making this request -- the client must discard its own tokens too,
    since this one will stop working on its very next use."""
    db.query(models.Session).filter(
        models.Session.user_id == current_user.id,
        models.Session.revoked.is_(False),
    ).update({"revoked": True})
    db.commit()

    log_activity_event(
        db,
        f"{current_user.display_name or current_user.username} logged out of all devices",
        icon="log-out",
        user_id=current_user.id,
        action="logout",
        entity_type="user",
        entity_id=current_user.id,
    )
    return None
