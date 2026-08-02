"""
Reusable FastAPI dependencies for authentication and project authorization.

Kept in its own module (rather than inside `routers/auth.py`) so every
other router can `from ..auth_dependencies import require_permission` etc.
without importing the auth router itself -- same reasoning
`project_helpers.py`/`activity_log.py` already use for staying standalone
(see that module's own docstring).

Two layers, matching the task brief's "AUTHORIZATION" section:

1. Authentication -- "who is making this request?" (`get_current_user`,
   `get_current_user_optional`, `get_current_session`).
2. Authorization -- "are they allowed to do this?" (`require_membership`,
   `require_role`, `require_permission`, `require_owner`, `require_admin`).
   These are dependency *factories*: call them with the argument they
   need (a role name / permission key) and pass the returned callable to
   `Depends(...)`. They never re-derive membership/permission logic
   themselves -- every check delegates to the existing
   `project_helpers.py` RBAC helpers, per the task brief's "Do NOT
   duplicate permission logic."

Every dependency here expects a `project_id` path parameter to already
be present on the route it's attached to (all Project Workspace/
collaboration routers already scope their prefix as
`/api/projects/{project_id}/...`), and reads it the same way FastAPI
lets any dependency read a path param: by naming it in the dependency
function's own signature.
"""
from datetime import datetime
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from . import models, project_helpers
from .activity_log import log_activity_event
from .database import get_db
from .security import TokenError, decode_access_token

# A single, consistent 401 body for every "not authenticated" case, per
# the task brief's "Consistent authentication errors" -- callers never
# need to guess whether a 401 means "no token," "expired token," or
# "revoked session"; the client's only correct action in every case is
# "send the user to log in again."
_AUTH_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


def _resolve_user_and_session(
    token: str, db: DBSession
) -> tuple[models.User, models.Session]:
    try:
        payload = decode_access_token(token)
    except TokenError:
        raise _AUTH_ERROR

    user_id = payload.get("sub")
    session_id = payload.get("sid")
    if not user_id or not session_id:
        raise _AUTH_ERROR

    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session or session.revoked or session.user_id != user_id:
        raise _AUTH_ERROR
    if session.expires_at and session.expires_at < datetime.utcnow():
        raise _AUTH_ERROR

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise _AUTH_ERROR
    if user.status in (models.UserStatus.suspended, models.UserStatus.deactivated):
        raise HTTPException(status_code=403, detail="This account is no longer active")

    return user, session


# ======================================================================
# Authentication dependencies
# ======================================================================

def get_current_user_and_session(
    authorization: Optional[str] = Header(default=None),
    db: DBSession = Depends(get_db),
) -> tuple[models.User, models.Session]:
    """Require authentication. Returns `(User, Session)` -- most routes
    only need the User (see `get_current_user` below), but logout/session
    endpoints need to know *which* session the current request is using."""
    token = _extract_bearer_token(authorization)
    if not token:
        raise _AUTH_ERROR
    return _resolve_user_and_session(token, db)


def get_current_user(
    user_and_session: tuple[models.User, models.Session] = Depends(get_current_user_and_session),
) -> models.User:
    """Require authentication. The ordinary dependency for any endpoint
    that just needs "the logged-in User" (this is `require_authentication`
    from the task brief's "AUTHORIZATION" list, named to match FastAPI's
    own `get_current_user` convention)."""
    return user_and_session[0]


def get_current_user_optional(
    authorization: Optional[str] = Header(default=None),
    db: DBSession = Depends(get_db),
) -> Optional[models.User]:
    """Never raises. For endpoints like `GET /api/auth/status` that
    behave differently for authenticated vs. anonymous callers instead
    of rejecting anonymous ones outright."""
    token = _extract_bearer_token(authorization)
    if not token:
        return None
    try:
        user, _session = _resolve_user_and_session(token, db)
    except HTTPException:
        return None
    return user


# ======================================================================
# Authorization dependencies (project-scoped)
# ======================================================================

def _log_permission_denied(db: DBSession, user: models.User, project_id: str, reason: str) -> None:
    log_activity_event(
        db,
        f"Permission denied: {reason}",
        icon="shield-alert",
        user_id=user.id,
        project_id=project_id,
        action="permission_denied",
        entity_type="project",
        entity_id=project_id,
    )


def require_membership():
    """Require the current User to be an active member (or the owner)
    of the `{project_id}` in the route path."""

    def dependency(
        project_id: str,
        current_user: models.User = Depends(get_current_user),
        db: DBSession = Depends(get_db),
    ) -> models.User:
        if project_helpers.is_owner(db, project_id, current_user.id):
            return current_user
        if not project_helpers.is_member(db, project_id, current_user.id):
            _log_permission_denied(db, current_user, project_id, "not a project member")
            raise HTTPException(status_code=403, detail="You are not a member of this project")
        return current_user

    return dependency


def require_role(role_name: str):
    """Require the current User to hold `role_name` on `{project_id}`
    (case-insensitive, via `project_helpers.has_role`)."""

    def dependency(
        project_id: str,
        current_user: models.User = Depends(get_current_user),
        db: DBSession = Depends(get_db),
    ) -> models.User:
        if not project_helpers.has_role(db, project_id, current_user.id, role_name):
            _log_permission_denied(db, current_user, project_id, f'missing role "{role_name}"')
            raise HTTPException(status_code=403, detail=f'This action requires the "{role_name}" role')
        return current_user

    return dependency


def require_permission(permission_key: str):
    """Require the current User's effective permissions on `{project_id}`
    (role + overrides + implicit owner-has-everything, via
    `project_helpers.get_effective_permission_keys`) to include
    `permission_key`."""

    def dependency(
        project_id: str,
        current_user: models.User = Depends(get_current_user),
        db: DBSession = Depends(get_db),
    ) -> models.User:
        if not project_helpers.has_permission(db, project_id, current_user.id, permission_key):
            _log_permission_denied(db, current_user, project_id, f'missing permission "{permission_key}"')
            raise HTTPException(status_code=403, detail=f'You do not have the "{permission_key}" permission on this project')
        return current_user

    return dependency


def require_owner():
    """Require the current User to be the project's owner
    (`Project.owner_id`), per `project_helpers.is_owner`."""

    def dependency(
        project_id: str,
        current_user: models.User = Depends(get_current_user),
        db: DBSession = Depends(get_db),
    ) -> models.User:
        if not project_helpers.is_owner(db, project_id, current_user.id):
            _log_permission_denied(db, current_user, project_id, "not the project owner")
            raise HTTPException(status_code=403, detail="Only the project owner can perform this action")
        return current_user

    return dependency


def require_project_access(
    db: DBSession,
    current_user: models.User,
    project_id: str,
    permission_key: Optional[str] = None,
) -> None:
    """Inline counterpart to `require_membership`/`require_permission`
    above, for Project Workspace *content* routers (todos, milestones,
    phases, features, bugs, documents, project_resources, conversations,
    ai_handoffs, ai_analytics, project_zips, knowledge_articles,
    timeline, analytics, activity) whose routes are flat
    (`/api/todos/{id}`, not `/api/projects/{project_id}/todos/{id}`), so
    `project_id` is a query param, request-body field, or only knowable
    after the target row is fetched -- never a path param the `require_*`
    dependency factories above could read automatically. Same
    owner-or-permission logic as `require_permission`/`require_membership`,
    called directly inside the handler once it has a `project_id` by
    whatever means it already uses, instead of via `Depends`.

    `permission_key=None` means "any active member (or the owner)",
    matching `require_membership`'s behavior -- used for `view_*` reads.
    """
    if project_helpers.is_owner(db, project_id, current_user.id):
        return
    if permission_key:
        if project_helpers.has_permission(db, project_id, current_user.id, permission_key):
            return
        _log_permission_denied(db, current_user, project_id, f'missing permission "{permission_key}"')
        raise HTTPException(status_code=403, detail=f'You do not have the "{permission_key}" permission on this project')
    if not project_helpers.is_member(db, project_id, current_user.id):
        _log_permission_denied(db, current_user, project_id, "not a project member")
        raise HTTPException(status_code=403, detail="You are not a member of this project")


def require_admin():
    """Require the current User to be an Admin or the Owner (Owner is a
    superset of Admin -- see `project_helpers.is_admin`)."""

    def dependency(
        project_id: str,
        current_user: models.User = Depends(get_current_user),
        db: DBSession = Depends(get_db),
    ) -> models.User:
        if not project_helpers.is_admin(db, project_id, current_user.id):
            _log_permission_denied(db, current_user, project_id, "not a project admin")
            raise HTTPException(status_code=403, detail="This action requires Admin or Owner access")
        return current_user

    return dependency
