"""
Shared Project Workspace helpers.

`log_timeline_event` is the project-scoped analogue of
`activity_log.log_activity`: every Project Workspace router (phases,
features, todos, bugs, milestones, documents, project_resources) calls
this whenever something notable happens (phase completed, bug
resolved, milestone reached, etc.) instead of writing to TimelineEvent
directly, so the event shape stays consistent across the whole module.

Kept in its own module (rather than inside `routers/timeline.py`) so
every other Project Workspace router can import it without depending on
the timeline router itself -- avoids any risk of circular imports,
mirroring why `activity_log.py` exists as a standalone module instead of
living inside `routers/tasks.py`.
"""
import json
from typing import List, Optional

from sqlalchemy.orm import Session

from . import models


# ======================================================================
# Collaboration / RBAC helpers
#
# Added alongside the Project Members / Invitations / Roles / Permissions
# routers (see AI_HANDOFF.md). These are pure read-side helpers -- no
# request/response handling, no HTTPException -- so they're reusable both
# by those routers today and by the future authorization middleware
# described in ARCHITECTURE.md "Permission Flow", without that future
# session needing to re-derive membership/permission resolution logic.
# ======================================================================

def get_accessible_project_ids(db: Session, user_id: str) -> List[str]:
    """Every project id the given user can see: owned outright, plus
    projects where they hold an active ProjectMember row. Used by
    `routers/search.py` to keep Global Search from surfacing another
    project's todos/bugs/milestones/etc. in result snippets."""
    owned = [p.id for p in db.query(models.Project).filter(models.Project.owner_id == user_id).all()]
    member_rows = (
        db.query(models.ProjectMember)
        .filter(
            models.ProjectMember.user_id == user_id,
            models.ProjectMember.status == models.MemberStatus.active,
        )
        .all()
    )
    member_ids = [m.project_id for m in member_rows]
    return list(set(owned) | set(member_ids))


def get_project_owner(db: Session, project_id: str) -> Optional[models.User]:
    """The User referenced by Project.owner_id, or None if the project
    has no owner set (or the owner FK has been SET NULL)."""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project or not project.owner_id:
        return None
    return db.query(models.User).filter(models.User.id == project.owner_id).first()


def get_membership(db: Session, project_id: str, user_id: str) -> Optional[models.ProjectMember]:
    """The (project, user) ProjectMember row, regardless of status --
    callers that only want active members should check `.status`
    themselves, since e.g. `is_member` below intentionally does."""
    return (
        db.query(models.ProjectMember)
        .filter(
            models.ProjectMember.project_id == project_id,
            models.ProjectMember.user_id == user_id,
        )
        .first()
    )


def is_member(db: Session, project_id: str, user_id: str) -> bool:
    membership = get_membership(db, project_id, user_id)
    return bool(membership and membership.status == models.MemberStatus.active)


def is_owner(db: Session, project_id: str, user_id: str) -> bool:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    return bool(project and project.owner_id == user_id)


def has_role(db: Session, project_id: str, user_id: str, role_name: str) -> bool:
    """Case-insensitive match against the member's assigned Role.name
    (e.g. `has_role(db, pid, uid, "Admin")`). The project owner always
    also counts as having the "Owner" role even if their ProjectMember
    row's role_id has drifted, since ownership (Project.owner_id) is the
    source of truth for that one role."""
    if role_name.lower() == "owner" and is_owner(db, project_id, user_id):
        return True
    membership = get_membership(db, project_id, user_id)
    if not membership or not membership.role_id:
        return False
    role = db.query(models.Role).filter(models.Role.id == membership.role_id).first()
    return bool(role and role.name.lower() == role_name.lower())


def get_effective_permission_keys(db: Session, project_id: str, user_id: str) -> List[str]:
    """Union of the member's Role.permission_keys with their own
    ProjectMember.permission_overrides, per ARCHITECTURE.md "Permission
    Flow". The project owner implicitly gets every seeded permission
    key, even without an explicit ProjectMember/Role row, so ownership
    alone is always sufficient to manage a project.
    `permission_overrides` is additive-only (grants on top of the role)
    in this implementation -- see models.py's column comment for why a
    plain JSON list, rather than a richer grant/deny structure, was
    chosen; a future authorization session can extend this function if
    deny-overrides are ever needed."""
    if is_owner(db, project_id, user_id):
        return [p.key for p in db.query(models.Permission).all()]

    membership = get_membership(db, project_id, user_id)
    if not membership or membership.status != models.MemberStatus.active:
        return []

    keys = set(json.loads(membership.permission_overrides or "[]"))
    if membership.role_id:
        role = db.query(models.Role).filter(models.Role.id == membership.role_id).first()
        if role:
            keys.update(json.loads(role.permission_keys or "[]"))
    return sorted(keys)


def has_permission(db: Session, project_id: str, user_id: str, permission_key: str) -> bool:
    return permission_key in get_effective_permission_keys(db, project_id, user_id)


def is_admin(db: Session, project_id: str, user_id: str) -> bool:
    """Owner counts as admin too -- Owner is a strict superset of Admin."""
    return is_owner(db, project_id, user_id) or has_role(db, project_id, user_id, "Admin")


def can_invite(db: Session, project_id: str, user_id: str) -> bool:
    return has_permission(db, project_id, user_id, "invite_members")


def can_manage_members(db: Session, project_id: str, user_id: str) -> bool:
    return has_permission(db, project_id, user_id, "manage_members")


def can_manage_project(db: Session, project_id: str, user_id: str) -> bool:
    return has_permission(db, project_id, user_id, "manage_project")


def count_active_owners(db: Session, project_id: str) -> int:
    """How many active members currently hold the "Owner" role on this
    project -- used to block removing/demoting the last owner. Counts
    ProjectMember rows whose Role is named "Owner", not just
    `Project.owner_id`, since a project could in principle have more
    than one ProjectMember with the Owner role assigned."""
    owner_role_ids = [r.id for r in db.query(models.Role).filter(models.Role.name == "Owner").all()]
    if not owner_role_ids:
        return 0
    return (
        db.query(models.ProjectMember)
        .filter(
            models.ProjectMember.project_id == project_id,
            models.ProjectMember.status == models.MemberStatus.active,
            models.ProjectMember.role_id.in_(owner_role_ids),
        )
        .count()
    )


def get_or_create_user_by_email(
    db: Session,
    email: str,
    display_name: str = "",
    status: models.UserStatus = models.UserStatus.invited,
) -> models.User:
    """Looks up a User by email, creating a placeholder row (status
    defaults to `invited`, per `UserStatus.invited`'s docstring: "created
    ahead of the user's first login, e.g. via a ProjectInvitation") if
    none exists yet. No authentication/registration is implemented here
    -- this only creates the identity row that ProjectMember/
    ProjectInvitation need to reference, exactly as `models.User`'s own
    docstring describes ("usable standalone today"). A future auth
    session is what actually lets that User log in."""
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        return user

    username_base = email.split("@")[0][:40] or "user"
    username = username_base
    suffix = 1
    while db.query(models.User).filter(models.User.username == username).first():
        suffix += 1
        username = f"{username_base}{suffix}"[:50]

    user = models.User(
        username=username,
        display_name=display_name or username_base,
        email=email,
        status=status,
    )
    db.add(user)
    db.flush()  # assigns an id without committing, mirroring main.py's seed pattern
    return user


def log_timeline_event(
    db: Session,
    project_id: str,
    event_type: str,
    title: str,
    description: str = "",
    icon: str = "activity",
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
) -> models.TimelineEvent:
    entry = models.TimelineEvent(
        project_id=project_id,
        event_type=event_type,
        title=title,
        description=description,
        icon=icon,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
