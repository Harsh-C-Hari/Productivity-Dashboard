"""
`ProjectInvitation` lifecycle (see ARCHITECTURE.md "Invitation Flow").

Creating, listing, and cancelling an invitation are project-scoped
(`/api/projects/{project_id}/invitations`, matching every other
collaboration router). Accepting/rejecting/expiring an invitation are
exposed separately under `/api/invitations/{token}` instead, since the
invitee follows an opaque emailed link and doesn't necessarily know (or
need to know) the project's id or the invitation's row id -- `token` is
the identifier they actually hold, per `models.ProjectInvitation`'s own
docstring ("the future email-link identifier"). Email sending itself is
out of scope for this session (task brief: "Email sending is NOT
required").
"""
import secrets
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..activity_log import log_activity_event
from ..auth_dependencies import require_membership, require_permission
from ..notification_helpers import create_notification, delete_stale_invitation_notifications
from ..project_helpers import collaboration_allowed, get_membership, get_or_create_user_by_email
from .projects import get_project_or_404

router = APIRouter(prefix="/api/projects/{project_id}/invitations", tags=["project-invitations"])
token_router = APIRouter(prefix="/api/invitations", tags=["project-invitations"])

# Create/list/cancel/expire (above, project-scoped) require the "invite_members"
# permission or active membership, via auth_dependencies.py. The
# token-scoped routes below (get/accept/reject) are deliberately left
# unauthenticated: the invitee holds an opaque token instead of a
# session, and may not have a User account (or be logged in) yet -- the
# token itself is the credential, per ProjectInvitation.token's own
# docstring.


# ---------- Shared helpers ----------

def serialize_invitation(invitation: models.ProjectInvitation) -> schemas.ProjectInvitationOut:
    return schemas.ProjectInvitationOut.model_validate(invitation)


def _resolve_expiry(db: Session, invitation: models.ProjectInvitation) -> models.ProjectInvitation:
    """Lazily flips a `pending` invitation to `expired` once its
    `expires_at` has passed, on read -- so "Expire invitation" doesn't
    require a background job to be considered complete, mirroring how
    the rest of this app computes derived state on the fly (e.g.
    `urgency.py`) rather than via a scheduler."""
    if invitation.status == models.InvitationStatus.pending and invitation.expires_at < utc_now():
        invitation.status = models.InvitationStatus.expired
        db.commit()
        db.refresh(invitation)
    return invitation


def get_invitation_by_id_or_404(db: Session, project_id: str, invitation_id: str) -> models.ProjectInvitation:
    invitation = (
        db.query(models.ProjectInvitation)
        .filter(models.ProjectInvitation.id == invitation_id, models.ProjectInvitation.project_id == project_id)
        .first()
    )
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return _resolve_expiry(db, invitation)


def get_invitation_by_token_or_404(db: Session, token: str) -> models.ProjectInvitation:
    invitation = db.query(models.ProjectInvitation).filter(models.ProjectInvitation.token == token).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return _resolve_expiry(db, invitation)


# ---------- Project-scoped: create / list / cancel ----------

@router.get("", response_model=List[schemas.ProjectInvitationOut])
def list_invitations(
    project_id: str,
    status: Optional[models.InvitationStatus] = None,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_membership()),
):
    get_project_or_404(db, project_id)
    query = db.query(models.ProjectInvitation).filter(models.ProjectInvitation.project_id == project_id)
    invitations = query.order_by(models.ProjectInvitation.created_at.desc()).all()
    invitations = [_resolve_expiry(db, i) for i in invitations]
    if status:
        invitations = [i for i in invitations if i.status == status]
    return [serialize_invitation(i) for i in invitations]


@router.post("", response_model=schemas.ProjectInvitationOut, status_code=201)
def create_invitation(
    project_id: str,
    payload: schemas.ProjectInvitationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("invite_members")),
):
    """Create invitation. Validates: the project exists, the assigned
    role (if any) exists, the email isn't already an active member of
    this project, and there isn't already a pending invitation for the
    same (project, email) pair. `invited_by_user_id` is always the
    authenticated caller, regardless of what the request body sends --
    one member should never be able to attribute an invitation to
    someone else."""
    project = get_project_or_404(db, project_id)

    if not collaboration_allowed(project):
        raise HTTPException(
            status_code=409,
            detail="This project is personal and collaboration is off. Enable collaboration in project settings before inviting members.",
        )

    if payload.role_id and not db.query(models.Role).filter(models.Role.id == payload.role_id).first():
        raise HTTPException(status_code=404, detail="Role not found")

    existing_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing_user:
        membership = get_membership(db, project_id, existing_user.id)
        if membership and membership.status == models.MemberStatus.active:
            raise HTTPException(status_code=409, detail=f'"{payload.email}" is already a member of this project')

    duplicate = (
        db.query(models.ProjectInvitation)
        .filter(
            models.ProjectInvitation.project_id == project_id,
            models.ProjectInvitation.email == payload.email,
            models.ProjectInvitation.status == models.InvitationStatus.pending,
        )
        .first()
    )
    if duplicate:
        duplicate = _resolve_expiry(db, duplicate)
        if duplicate.status == models.InvitationStatus.pending:
            raise HTTPException(status_code=409, detail=f'A pending invitation already exists for "{payload.email}"')

    invitation = models.ProjectInvitation(
        project_id=project_id,
        email=payload.email,
        role_id=payload.role_id,
        invited_by_user_id=current_user.id,
        token=secrets.token_urlsafe(32),
        expires_at=payload.expires_at,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    log_activity_event(
        db,
        f'Invited {payload.email} to project "{project.name}"',
        icon="mail-plus",
        user_id=current_user.id,
        project_id=project_id,
        action="invited",
        entity_type="invitation",
        entity_id=invitation.id,
    )

    # In-app invitation: if the invited email already belongs to a User
    # account, they get a real in-app Notification (with Accept/Reject
    # actions) immediately -- no email required, per the task brief's
    # "Complete this system WITHOUT SMTP" / "In-App Invitations".
    if existing_user:
        inviter_name = current_user.display_name or current_user.username
        create_notification(
            db,
            user_id=existing_user.id,
            category=models.NotificationCategory.project_invitation,
            title=f'{inviter_name} invited you to join "{project.name}"',
            message=f"Role: {invitation.role.name if invitation.role else 'Member'}",
            project_id=project_id,
            invitation_id=invitation.id,
            action_url=f"/invite/{invitation.token}",
        )

    return serialize_invitation(invitation)


@router.post("/{invitation_id}/cancel", response_model=schemas.ProjectInvitationOut)
def cancel_invitation(
    project_id: str,
    invitation_id: str,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_permission("invite_members")),
):
    """Cancel invitation (revokes a still-pending invite before it's
    accepted/rejected/expired)."""
    invitation = get_invitation_by_id_or_404(db, project_id, invitation_id)
    if invitation.status != models.InvitationStatus.pending:
        raise HTTPException(status_code=409, detail=f"Cannot cancel an invitation with status \"{invitation.status.value}\"")

    invitation.status = models.InvitationStatus.revoked
    db.commit()
    db.refresh(invitation)
    log_activity_event(
        db,
        f"Cancelled invitation to {invitation.email}",
        icon="mail-x",
        project_id=project_id,
        action="cancelled",
        entity_type="invitation",
        entity_id=invitation.id,
    )

    invitee = db.query(models.User).filter(models.User.email == invitation.email).first()
    if invitee:
        project = get_project_or_404(db, project_id)
        create_notification(
            db,
            user_id=invitee.id,
            category=models.NotificationCategory.invitation_cancelled,
            title=f'Your invitation to "{project.name}" was cancelled',
            project_id=project_id,
            invitation_id=invitation.id,
        )

    return serialize_invitation(invitation)


@router.post("/{invitation_id}/resend", response_model=schemas.ProjectInvitationOut)
def resend_invitation(
    project_id: str,
    invitation_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_permission("invite_members")),
):
    """Resend invitation. There is no SMTP/email delivery in this app
    (see module docstring), so "Resend" does the useful, real thing it
    can do without email: issues a fresh, unguessable token, restarts a
    full expiry window (mirrors the original invitation's lifetime --
    `ProjectInvitationCreate.expires_at` isn't re-sent, so this reuses
    the gap between the existing `created_at`/original `expires_at`,
    with a 7-day floor if that gap is unavailable/degenerate), and
    reopens the invitation if it had expired/was cancelled. If the
    invitee already has an account, they also get a fresh in-app
    Notification -- the actual "resend" for an in-app user. The owner's
    UI is expected to then use the returned `token`/link (Copy Invite
    Link) since there's no email to resend it via."""
    invitation = get_invitation_by_id_or_404(db, project_id, invitation_id)
    if invitation.status not in (
        models.InvitationStatus.pending,
        models.InvitationStatus.expired,
        models.InvitationStatus.revoked,
    ):
        raise HTTPException(
            status_code=409,
            detail=f'Cannot resend an invitation that has already been "{invitation.status.value}"',
        )

    from datetime import timedelta
    original_window = invitation.expires_at - invitation.created_at
    window = original_window if original_window.total_seconds() > 0 else timedelta(days=7)

    invitation.token = secrets.token_urlsafe(32)
    invitation.status = models.InvitationStatus.pending
    invitation.expires_at = utc_now() + window
    invitation.accepted_at = None
    invitation.rejected_at = None
    db.commit()
    db.refresh(invitation)

    project = get_project_or_404(db, project_id)
    log_activity_event(
        db,
        f"Resent invitation to {invitation.email}",
        icon="mail-plus",
        user_id=current_user.id,
        project_id=project_id,
        action="resent",
        entity_type="invitation",
        entity_id=invitation.id,
    )

    existing_user = db.query(models.User).filter(models.User.email == invitation.email).first()
    if existing_user:
        delete_stale_invitation_notifications(db, invitation.id)
        inviter_name = current_user.display_name or current_user.username
        create_notification(
            db,
            user_id=existing_user.id,
            category=models.NotificationCategory.project_invitation,
            title=f'{inviter_name} re-sent your invitation to join "{project.name}"',
            message=f"Role: {invitation.role.name if invitation.role else 'Member'}",
            project_id=project_id,
            invitation_id=invitation.id,
            action_url=f"/invite/{invitation.token}",
        )

    return serialize_invitation(invitation)


@router.post("/{invitation_id}/expire", response_model=schemas.ProjectInvitationOut)
def expire_invitation(
    project_id: str,
    invitation_id: str,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_permission("invite_members")),
):
    """Expire invitation: an explicit, on-demand equivalent of what
    `_resolve_expiry` does lazily on every read -- useful for a future
    scheduled job or admin action that wants to force the transition
    immediately rather than waiting for the next GET."""
    invitation = (
        db.query(models.ProjectInvitation)
        .filter(models.ProjectInvitation.id == invitation_id, models.ProjectInvitation.project_id == project_id)
        .first()
    )
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.status != models.InvitationStatus.pending:
        raise HTTPException(status_code=409, detail=f"Cannot expire an invitation with status \"{invitation.status.value}\"")

    invitation.status = models.InvitationStatus.expired
    db.commit()
    db.refresh(invitation)
    return serialize_invitation(invitation)


# ---------- Token-scoped: accept / reject ----------

@token_router.get("/{token}", response_model=schemas.InvitationPreviewOut)
def get_invitation_by_token(token: str, db: Session = Depends(get_db)):
    """Public preview of an invitation by token -- deliberately not
    behind `require_project_access`, since the whole point is that the
    invitee doesn't have project access yet (see `InvitationPreviewOut`
    docstring)."""
    invitation = get_invitation_by_token_or_404(db, token)
    project = db.query(models.Project).filter(models.Project.id == invitation.project_id).first()
    inviter = (
        db.query(models.User).filter(models.User.id == invitation.invited_by_user_id).first()
        if invitation.invited_by_user_id else None
    )
    role = db.query(models.Role).filter(models.Role.id == invitation.role_id).first() if invitation.role_id else None

    data = schemas.ProjectInvitationOut.model_validate(invitation).model_dump()
    data.update(
        project_name=project.name if project else "",
        project_icon=project.icon if project else "",
        project_color=project.color if project else "",
        invited_by_name=(inviter.display_name or inviter.username) if inviter else None,
        role_name=role.name if role else None,
    )
    return schemas.InvitationPreviewOut.model_validate(data)


@token_router.post("/{token}/accept", response_model=schemas.ProjectMemberOut)
def accept_invitation(token: str, display_name: str = Query(default=""), db: Session = Depends(get_db)):
    """Accept invitation. Finds or creates the invitee's `User` row by
    email (no auth/registration here -- see
    `project_helpers.get_or_create_user_by_email`), then creates (or
    reactivates) their `ProjectMember` row with the invitation's
    assigned role, active status, and `invitation_accepted=True`."""
    invitation = get_invitation_by_token_or_404(db, token)
    if invitation.status != models.InvitationStatus.pending:
        raise HTTPException(status_code=409, detail=f"This invitation is {invitation.status.value} and can no longer be accepted")

    project = get_project_or_404(db, invitation.project_id)
    user = get_or_create_user_by_email(db, invitation.email, display_name=display_name, status=models.UserStatus.active)

    membership = get_membership(db, invitation.project_id, user.id)
    if membership:
        membership.status = models.MemberStatus.active
        membership.invitation_accepted = True
        membership.role_id = invitation.role_id or membership.role_id
    else:
        import json as _json
        membership = models.ProjectMember(
            project_id=invitation.project_id,
            user_id=user.id,
            role_id=invitation.role_id,
            status=models.MemberStatus.active,
            invitation_accepted=True,
            permission_overrides=_json.dumps([]),
        )
        db.add(membership)

    invitation.status = models.InvitationStatus.accepted
    invitation.accepted_at = utc_now()
    db.commit()
    db.refresh(membership)

    log_activity_event(
        db,
        f'{user.display_name or user.username} accepted the invitation to join project "{project.name}"',
        icon="user-check",
        user_id=user.id,
        project_id=invitation.project_id,
        action="accepted",
        entity_type="invitation",
        entity_id=invitation.id,
    )

    if invitation.invited_by_user_id:
        create_notification(
            db,
            user_id=invitation.invited_by_user_id,
            category=models.NotificationCategory.invitation_accepted,
            title=f'{user.display_name or user.username} accepted your invitation to "{project.name}"',
            project_id=invitation.project_id,
            invitation_id=invitation.id,
            action_url=f"/projects/{invitation.project_id}",
        )
    create_notification(
        db,
        user_id=user.id,
        category=models.NotificationCategory.member_joined,
        title=f'You joined "{project.name}"',
        project_id=invitation.project_id,
        action_url=f"/projects/{invitation.project_id}",
    )

    from .project_members import serialize_member
    return serialize_member(membership)


@token_router.post("/{token}/reject", response_model=schemas.ProjectInvitationOut)
def reject_invitation(token: str, db: Session = Depends(get_db)):
    """Reject invitation."""
    invitation = get_invitation_by_token_or_404(db, token)
    if invitation.status != models.InvitationStatus.pending:
        raise HTTPException(status_code=409, detail=f"This invitation is {invitation.status.value} and can no longer be rejected")

    invitation.status = models.InvitationStatus.rejected
    invitation.rejected_at = utc_now()
    db.commit()
    db.refresh(invitation)

    log_activity_event(
        db,
        f"Invitation to {invitation.email} was rejected",
        icon="user-x",
        project_id=invitation.project_id,
        action="rejected",
        entity_type="invitation",
        entity_id=invitation.id,
    )

    if invitation.invited_by_user_id:
        project = get_project_or_404(db, invitation.project_id)
        create_notification(
            db,
            user_id=invitation.invited_by_user_id,
            category=models.NotificationCategory.invitation_rejected,
            title=f'{invitation.email} declined your invitation to "{project.name}"',
            project_id=invitation.project_id,
            invitation_id=invitation.id,
        )

    return serialize_invitation(invitation)
