"""
Project membership lifecycle: list/add/remove members, change role or
status, transfer ownership, and leave a project. `ProjectMember` is the
join table that makes a `Project` collaborative (see ARCHITECTURE.md
"Membership Model") -- every endpoint here is scoped under
`/api/projects/{project_id}/members`, matching the "Projects remain the
primary collaborative container" architectural rule.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity, log_activity_event
from ..auth_dependencies import get_current_user, require_membership, require_owner, require_permission
from ..notification_helpers import create_notification
from ..project_helpers import count_active_owners, get_membership, is_admin
from .projects import get_project_or_404

router = APIRouter(prefix="/api/projects/{project_id}/members", tags=["project-members"])


# ---------- Serialization ----------

def serialize_member(member: models.ProjectMember) -> schemas.ProjectMemberOut:
    return schemas.ProjectMemberOut.model_validate(
        {
            "id": member.id,
            "project_id": member.project_id,
            "user_id": member.user_id,
            "role_id": member.role_id,
            "status": member.status,
            "invitation_accepted": member.invitation_accepted,
            "permission_overrides": json.loads(member.permission_overrides or "[]"),
            "joined_at": member.joined_at,
            "last_active_at": member.last_active_at,
        }
    )


def get_member_or_404(db: Session, project_id: str, member_id: str) -> models.ProjectMember:
    member = (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.id == member_id, models.ProjectMember.project_id == project_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Project member not found")
    return member


def _get_role_or_404(db: Session, role_id: str) -> models.Role:
    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


def _is_owner_role(role: Optional[models.Role]) -> bool:
    return bool(role and role.name == "Owner")


# ---------- CRUD ----------

@router.get("", response_model=List[schemas.ProjectMemberOut])
def list_members(
    project_id: str,
    status: Optional[models.MemberStatus] = None,
    role_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_membership()),
):
    get_project_or_404(db, project_id)
    query = db.query(models.ProjectMember).filter(models.ProjectMember.project_id == project_id)
    if status:
        query = query.filter(models.ProjectMember.status == status)
    if role_id:
        query = query.filter(models.ProjectMember.role_id == role_id)
    members = query.order_by(models.ProjectMember.joined_at.asc()).all()
    return [serialize_member(m) for m in members]


@router.get("/summary", response_model=schemas.ProjectCollaborationSummary)
def get_collaboration_summary(
    project_id: str,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_membership()),
):
    """Per-project collaboration rollup -- same role as `ProjectSummary`
    (work items) but for membership. Registered before `/{member_id}`
    so the literal path `summary` is matched first."""
    project = get_project_or_404(db, project_id)
    active_member_count = (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.project_id == project_id, models.ProjectMember.status == models.MemberStatus.active)
        .count()
    )
    member_count = db.query(models.ProjectMember).filter(models.ProjectMember.project_id == project_id).count()
    pending_invitation_count = (
        db.query(models.ProjectInvitation)
        .filter(
            models.ProjectInvitation.project_id == project_id,
            models.ProjectInvitation.status == models.InvitationStatus.pending,
        )
        .count()
    )
    owner = db.query(models.User).filter(models.User.id == project.owner_id).first() if project.owner_id else None
    return schemas.ProjectCollaborationSummary(
        project_id=project_id,
        member_count=member_count,
        active_member_count=active_member_count,
        pending_invitation_count=pending_invitation_count,
        owner=schemas.UserOut.model_validate(owner) if owner else None,
    )


@router.get("/{member_id}", response_model=schemas.ProjectMemberOut)
def get_member(
    project_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_membership()),
):
    get_project_or_404(db, project_id)
    return serialize_member(get_member_or_404(db, project_id, member_id))


@router.post("", response_model=schemas.ProjectMemberOut, status_code=201)
def add_member(
    project_id: str,
    payload: schemas.ProjectMemberCreate,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_permission("manage_members")),
):
    """Add member. `payload.project_id` is ignored in favor of the path
    parameter (avoids a mismatched-body-vs-path 404/duplicate footgun);
    `payload.user_id` must reference an existing `User` -- this router
    doesn't create identities (see `routers/users.py`, or accept an
    invitation via `routers/project_invitations.py`, for how a User row
    comes to exist without an auth system)."""
    project = get_project_or_404(db, project_id)

    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if get_membership(db, project_id, payload.user_id):
        raise HTTPException(status_code=409, detail="User is already a member of this project")

    role = None
    if payload.role_id:
        role = _get_role_or_404(db, payload.role_id)

    member = models.ProjectMember(
        project_id=project_id,
        user_id=payload.user_id,
        role_id=payload.role_id,
        status=payload.status,
        invitation_accepted=payload.invitation_accepted,
        permission_overrides=json.dumps(payload.permission_overrides),
    )
    db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="User is already a member of this project")
    db.refresh(member)

    log_activity_event(
        db,
        f'{user.display_name or user.username} added to project "{project.name}"'
        + (f" as {role.name}" if role else ""),
        icon="user-plus",
        user_id=user.id,
        project_id=project_id,
        action="added",
        entity_type="member",
        entity_id=member.id,
    )
    return serialize_member(member)


@router.patch("/{member_id}", response_model=schemas.ProjectMemberOut)
def update_member(
    project_id: str,
    member_id: str,
    payload: schemas.ProjectMemberUpdate,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_permission("manage_members")),
):
    """Update member role and/or status (and permission_overrides) in
    one endpoint, mirroring the rest of the app's `PATCH` convention.
    Blocks any change that would leave the project with zero active
    Owners (demoting the last Owner's role, or suspending/removing
    them) -- use `transfer-ownership` first instead."""
    get_project_or_404(db, project_id)
    member = get_member_or_404(db, project_id, member_id)
    data = payload.model_dump(exclude_unset=True)

    current_role = db.query(models.Role).filter(models.Role.id == member.role_id).first() if member.role_id else None
    member_is_active_owner = _is_owner_role(current_role) and member.status == models.MemberStatus.active

    if member_is_active_owner and count_active_owners(db, project_id) <= 1:
        demoting_role = "role_id" in data and data["role_id"] != member.role_id
        removing_status = "status" in data and data["status"] != models.MemberStatus.active
        if demoting_role or removing_status:
            raise HTTPException(
                status_code=409,
                detail="Cannot change the project's last remaining Owner. Transfer ownership first.",
            )

    if "role_id" in data and data["role_id"]:
        _get_role_or_404(db, data["role_id"])

    if "permission_overrides" in data:
        member.permission_overrides = json.dumps(data.pop("permission_overrides") or [])

    for field, value in data.items():
        setattr(member, field, value)

    db.commit()
    db.refresh(member)
    log_activity(db, "Updated project member", icon="user-cog")
    return serialize_member(member)


@router.delete("/{member_id}", status_code=204)
def remove_member(
    project_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_permission("manage_members")),
):
    """Remove member. Blocked if the member is the project's last
    active Owner -- transfer ownership to someone else first."""
    project = get_project_or_404(db, project_id)
    member = get_member_or_404(db, project_id, member_id)

    role = db.query(models.Role).filter(models.Role.id == member.role_id).first() if member.role_id else None
    if _is_owner_role(role) and member.status == models.MemberStatus.active and count_active_owners(db, project_id) <= 1:
        raise HTTPException(
            status_code=409,
            detail="Cannot remove the project's last remaining Owner. Transfer ownership first.",
        )

    user_id = member.user_id
    db.delete(member)
    db.commit()
    log_activity_event(
        db,
        f'Removed a member from project "{project.name}"',
        icon="user-minus",
        user_id=user_id,
        project_id=project_id,
        action="removed",
        entity_type="member",
        entity_id=member_id,
    )
    # `project_id` is intentionally omitted here (unlike member_joined/etc)
    # -- the recipient no longer has access to that project, so a
    # notification carrying its id would let the frontend try to deep-link
    # into a page it's about to be bounced back out of (see
    # lib/queryClient.ts's project-access-lost handling). Point `action_url`
    # at the project list instead of the now-inaccessible project itself.
    create_notification(
        db,
        user_id=user_id,
        category=models.NotificationCategory.project_access_revoked,
        title=f'You were removed from "{project.name}"',
        action_url="/projects",
    )
    return None


# ---------- Ownership transfer & self-service leave ----------

@router.post("/transfer-ownership", response_model=schemas.ProjectMemberOut)
def transfer_ownership(
    project_id: str,
    new_owner_user_id: str = Query(...),
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_owner()),
):
    """Transfer ownership to another active project member. Validates
    that: the project exists, the target user is an existing active
    member of the project, and they aren't already the owner. The
    previous owner (if any, and if still an active member) is demoted
    to the "Admin" role rather than left without one; the new owner is
    assigned the "Owner" role. `Project.owner_id` and the ProjectMember
    row's `role_id` are updated together so they never disagree about
    who the owner is (see ARCHITECTURE.md "Ownership Model")."""
    project = get_project_or_404(db, project_id)

    if project.owner_id == new_owner_user_id:
        raise HTTPException(status_code=422, detail="That user is already the project owner")

    new_owner_membership = get_membership(db, project_id, new_owner_user_id)
    if not new_owner_membership or new_owner_membership.status != models.MemberStatus.active:
        raise HTTPException(status_code=422, detail="The new owner must already be an active member of this project")

    owner_role = db.query(models.Role).filter(models.Role.name == "Owner", models.Role.project_id.is_(None)).first()
    admin_role = db.query(models.Role).filter(models.Role.name == "Admin", models.Role.project_id.is_(None)).first()
    if not owner_role:
        raise HTTPException(status_code=500, detail='System "Owner" role is missing; re-seed roles before transferring ownership')

    previous_owner_id = project.owner_id
    if previous_owner_id:
        previous_membership = get_membership(db, project_id, previous_owner_id)
        if previous_membership and admin_role:
            previous_membership.role_id = admin_role.id

    project.owner_id = new_owner_user_id
    new_owner_membership.role_id = owner_role.id
    db.commit()
    db.refresh(new_owner_membership)

    new_owner = db.query(models.User).filter(models.User.id == new_owner_user_id).first()
    log_activity_event(
        db,
        f'Ownership of project "{project.name}" transferred to {new_owner.display_name or new_owner.username if new_owner else new_owner_user_id}',
        icon="crown",
        user_id=new_owner_user_id,
        project_id=project_id,
        action="ownership_transferred",
        entity_type="project",
        entity_id=project_id,
    )
    return serialize_member(new_owner_membership)


@router.post("/leave", status_code=204)
def leave_project(
    project_id: str,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Leave project: the given user removes themselves. Requires
    authentication; `user_id` must match the caller unless the caller is
    a project Admin/Owner removing someone else on their behalf (that's
    still "leave," not "remove," when the target consents out-of-band --
    e.g. an Admin cleaning up for a teammate who asked to be taken off
    the project). Blocked if they're the project's last active Owner --
    they must transfer ownership to another member first."""
    if user_id != current_user.id and not is_admin(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="You can only remove yourself, unless you are a project Admin or Owner")
    project = get_project_or_404(db, project_id)
    membership = get_membership(db, project_id, user_id)
    if not membership:
        raise HTTPException(status_code=404, detail="User is not a member of this project")

    role = db.query(models.Role).filter(models.Role.id == membership.role_id).first() if membership.role_id else None
    if _is_owner_role(role) and membership.status == models.MemberStatus.active and count_active_owners(db, project_id) <= 1:
        raise HTTPException(
            status_code=409,
            detail="You are the project's last remaining Owner. Transfer ownership before leaving.",
        )

    db.delete(membership)
    db.commit()
    log_activity_event(
        db,
        f'A member left project "{project.name}"',
        icon="log-out",
        user_id=user_id,
        project_id=project_id,
        action="left",
        entity_type="member",
        entity_id=membership.id,
    )
    return None
