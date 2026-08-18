"""
Authentication API: registration, login/logout (local password and
Google Sign-In), JWT access + refresh tokens, current-user profile
management, password reset, and email verification.

Password reset and email verification issue/validate tokens and send
real mail via `email_utils` whenever SMTP is configured (see
backend/.env.example); with no SMTP configured they fall back to
returning the raw token in the response, gated behind
`AUTH_DEBUG_EXPOSE_TOKENS`, so local/dev usage never requires a mail
server. Google Sign-In (`POST /google`) verifies a Google Identity
Services ID token server-side against `GOOGLE_CLIENT_ID` -- see that
endpoint's docstring. Session listing/revocation lives in the sibling
`routers/sessions.py` (one router, one responsibility, per
ENGINEERING_GUIDELINES.md "Router Rules").

Every write here that changes account/security state calls
`log_activity_event` (see AI_HANDOFF.md "Activity Logging"), mirroring
every other collaboration router's convention.
"""
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from .. import models, schemas, email_utils
from ..activity_log import log_activity_event
from ..auth_dependencies import get_current_user, get_current_user_and_session, get_current_user_optional
from ..database import get_db
from ..timeutils import utc_now
from ..security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    EMAIL_VERIFICATION_EXPIRE_HOURS,
    PASSWORD_RESET_EXPIRE_MINUTES,
    PasswordPolicyError,
    create_access_token,
    generate_opaque_token,
    hash_password,
    hash_token,
    new_refresh_token,
    validate_password_strength,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ======================================================================
# Internal helpers
# ======================================================================

def _issue_tokens(
    db: DBSession,
    user: models.User,
    device: str = "",
    platform: str = "",
    browser: str = "",
) -> schemas.TokenResponse:
    """Creates a new Session row (one per login/registration -- i.e. one
    per device, supporting the task brief's "future multi-device
    support") and returns a matching access/refresh token pair."""
    raw_refresh, refresh_hash, refresh_expires_at = new_refresh_token()

    session = models.Session(
        user_id=user.id,
        device=device,
        platform=platform,
        browser=browser,
        expires_at=refresh_expires_at,
        refresh_token_hash=refresh_hash,
        last_active_at=utc_now(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    access_token = create_access_token(user.id, session.id)
    return schemas.TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=schemas.UserOut.model_validate(user),
    )


def _get_user_by_login_identifier(db: DBSession, identifier: str) -> "models.User | None":
    if "@" in identifier:
        return db.query(models.User).filter(models.User.email == identifier).first()
    return db.query(models.User).filter(models.User.username == identifier).first()


def _unique_username_from_email(db: DBSession, email: str) -> str:
    """Derives a username candidate from the local part of an email
    (e.g. "jane.doe@x.com" -> "janedoe"), then appends a numeric suffix
    until it's free. Only used for accounts created via Google sign-in,
    which never collects a username up front."""
    base = re.sub(r"[^a-zA-Z0-9_]", "", email.split("@")[0]).lower() or "user"
    base = base[:40]
    candidate = base
    suffix = 1
    while db.query(models.User).filter(models.User.username == candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


def _issue_and_send_verification_token(db: DBSession, user: models.User) -> bool:
    """Generates a fresh email-verification token, persists it, and emails
    it via `email_utils`. Shared by `register` (best-effort, fire-and-forget
    right after account creation) and `request_email_verification` (the
    explicit resend flow) so token-issuance + delivery lives in one place.
    Returns whether an email was actually sent (False if SMTP isn't
    configured or the send failed)."""
    token = generate_opaque_token(32)
    user.email_verification_token = token
    user.email_verification_expires_at = utc_now() + timedelta(hours=EMAIL_VERIFICATION_EXPIRE_HOURS)
    db.commit()
    return email_utils.send_verification_email(user.email, user.display_name or user.username, token)


# ======================================================================
# Registration / Login / Logout
# ======================================================================

@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
def register(payload: schemas.RegisterRequest, db: DBSession = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    try:
        validate_password_strength(payload.password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    user = models.User(
        username=payload.username,
        email=payload.email,
        display_name=payload.display_name or payload.username,
        password_hash=hash_password(payload.password),
        auth_provider=models.AuthProvider.local,
        status=models.UserStatus.active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity_event(
        db,
        f"{user.display_name or user.username} registered",
        icon="user-plus",
        user_id=user.id,
        action="registered",
        entity_type="user",
        entity_id=user.id,
    )

    # Best-effort: fire off a verification email right away when SMTP is
    # configured, so the person doesn't have to separately open
    # /verify-email and click "send". Never blocks registration --
    # if SMTP isn't set up (or a send fails), the user can still trigger
    # it later from /verify-email, same as before this existed.
    if email_utils.smtp_configured():
        _issue_and_send_verification_token(db, user)

    # Registration logs the user in immediately (issues a real session),
    # rather than requiring a separate follow-up login call.
    return _issue_tokens(db, user)


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: DBSession = Depends(get_db)):
    user = _get_user_by_login_identifier(db, payload.username_or_email)

    # Always run a bcrypt verify, even when no user was found, against a
    # fixed dummy hash -- otherwise a missing user returns faster than a
    # wrong password and the response-time difference leaks which
    # usernames/emails are registered.
    dummy_hash = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8dYuXTU0X1O5V8Y8Y8Y8Y8Y8Y8Y8Y."
    password_ok = verify_password(payload.password, user.password_hash if user else dummy_hash)

    if not user or not password_ok:
        raise HTTPException(status_code=401, detail="Incorrect username/email or password")

    if user.status == models.UserStatus.suspended:
        raise HTTPException(status_code=403, detail="This account has been suspended")
    if user.status == models.UserStatus.deactivated:
        raise HTTPException(status_code=403, detail="This account has been deactivated")
    if user.auth_provider != models.AuthProvider.local:
        raise HTTPException(status_code=400, detail=f"This account signs in via {user.auth_provider.value}, not a password")

    user.last_seen_at = utc_now()
    if user.status == models.UserStatus.invited:
        # First real login of a User row that was created ahead of time
        # by a ProjectInvitation accept (see project_helpers.get_or_create_user_by_email).
        user.status = models.UserStatus.active
    db.commit()
    db.refresh(user)

    tokens = _issue_tokens(db, user, device=payload.device, platform=payload.platform, browser=payload.browser)

    log_activity_event(
        db,
        f"{user.display_name or user.username} logged in",
        icon="log-in",
        user_id=user.id,
        action="login",
        entity_type="user",
        entity_id=user.id,
    )
    return tokens


@router.post("/logout", status_code=204)
def logout(
    user_and_session: tuple = Depends(get_current_user_and_session),
    db: DBSession = Depends(get_db),
):
    """Revokes the Session tied to the access token used for this
    request -- i.e. logs out the current device only. Use
    `/api/auth/sessions/logout-all` (routers/sessions.py) for every
    device at once."""
    user, session = user_and_session
    session.revoked = True
    db.commit()

    log_activity_event(
        db,
        f"{user.display_name or user.username} logged out",
        icon="log-out",
        user_id=user.id,
        action="logout",
        entity_type="session",
        entity_id=session.id,
    )
    return None


# ======================================================================
# Token refresh / revocation
# ======================================================================

@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh_token(payload: schemas.RefreshRequest, db: DBSession = Depends(get_db)):
    """Rotates the refresh token: the token in the request is checked
    against the stored hash, then immediately replaced by a new one on
    the same Session row. The old refresh token stops working the
    instant this succeeds, so a leaked-then-replayed old token is
    detectable (it will fail with "invalid or expired refresh token")."""
    token_hash = hash_token(payload.refresh_token)
    session = db.query(models.Session).filter(models.Session.refresh_token_hash == token_hash).first()

    if not session or session.revoked or session.expires_at < utc_now():
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.query(models.User).filter(models.User.id == session.user_id).first()
    if not user or user.status in (models.UserStatus.suspended, models.UserStatus.deactivated):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    raw_refresh, refresh_hash, refresh_expires_at = new_refresh_token()
    session.refresh_token_hash = refresh_hash
    session.expires_at = refresh_expires_at
    session.last_active_at = utc_now()
    db.commit()

    access_token = create_access_token(user.id, session.id)
    return schemas.TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/revoke", status_code=204)
def revoke_token(payload: schemas.RevokeRequest, db: DBSession = Depends(get_db)):
    """Revokes the Session behind a given refresh token, without
    requiring a currently-valid access token -- useful when an access
    token has already expired but the client still wants to force-log-out
    that device (e.g. "sign out" after a long-idle tab). Deliberately
    idempotent: revoking an already-revoked/unknown token still returns
    204, since the end state ("this token can't be used") already
    holds -- it never leaks whether the token existed."""
    token_hash = hash_token(payload.refresh_token)
    session = db.query(models.Session).filter(models.Session.refresh_token_hash == token_hash).first()
    if session and not session.revoked:
        session.revoked = True
        db.commit()
        log_activity_event(
            db,
            "A session was revoked",
            icon="shield-off",
            user_id=session.user_id,
            action="session_revoked",
            entity_type="session",
            entity_id=session.id,
        )
    return None


# ======================================================================
# Current user (`/me`)
# ======================================================================

@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserOut.model_validate(current_user)


@router.get("/status", response_model=schemas.AuthStatusOut)
def auth_status(current_user: "models.User | None" = Depends(get_current_user_optional)):
    """Never raises 401 -- tells the caller whether *it* is currently
    authenticated, for UI that needs to branch (e.g. show a login button
    vs. an account menu) without triggering a redirect-to-login."""
    if not current_user:
        return schemas.AuthStatusOut(authenticated=False, user=None)
    return schemas.AuthStatusOut(authenticated=True, user=schemas.UserOut.model_validate(current_user))


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(
    payload: schemas.ProfileUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(current_user, field, value)
    current_user.updated_at = utc_now()
    db.commit()
    db.refresh(current_user)

    log_activity_event(
        db,
        f"{current_user.display_name or current_user.username} updated profile",
        icon="user-cog",
        user_id=current_user.id,
        action="profile_updated",
        entity_type="user",
        entity_id=current_user.id,
    )
    return schemas.UserOut.model_validate(current_user)


@router.patch("/me/avatar", response_model=schemas.UserOut)
def update_avatar(
    payload: schemas.AvatarUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    current_user.avatar_url = payload.avatar_url
    current_user.updated_at = utc_now()
    db.commit()
    db.refresh(current_user)
    log_activity_event(
        db,
        f"{current_user.display_name or current_user.username} updated their avatar",
        icon="image",
        user_id=current_user.id,
        action="profile_updated",
        entity_type="user",
        entity_id=current_user.id,
    )
    return schemas.UserOut.model_validate(current_user)


@router.patch("/me/display-name", response_model=schemas.UserOut)
def update_display_name(
    payload: schemas.DisplayNameUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    current_user.display_name = payload.display_name
    current_user.updated_at = utc_now()
    db.commit()
    db.refresh(current_user)
    log_activity_event(
        db,
        f"{current_user.username} updated their display name",
        icon="user-cog",
        user_id=current_user.id,
        action="profile_updated",
        entity_type="user",
        entity_id=current_user.id,
    )
    return schemas.UserOut.model_validate(current_user)


@router.patch("/me/email", response_model=schemas.UserOut)
def update_email(
    payload: schemas.EmailUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Changing your email requires your current password (a
    security-sensitive change, same reasoning as `change_password`
    below) and always resets `email_verified` to False -- the new
    address hasn't been proven deliverable yet. Call
    `request_email_verification` afterwards to send a verification
    email to the new address."""
    if not verify_password(payload.current_password, current_user.password_hash or ""):
        raise HTTPException(status_code=401, detail="Incorrect password")
    if payload.email != current_user.email and db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    current_user.email = payload.email
    current_user.email_verified = False
    current_user.updated_at = utc_now()
    db.commit()
    db.refresh(current_user)

    log_activity_event(
        db,
        f"{current_user.display_name or current_user.username} changed their email address",
        icon="mail",
        user_id=current_user.id,
        action="profile_updated",
        entity_type="user",
        entity_id=current_user.id,
    )
    return schemas.UserOut.model_validate(current_user)


@router.post("/me/deactivate", status_code=204)
def deactivate_account(
    payload: schemas.DeactivateAccountRequest,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Soft delete: sets `status=deactivated` (the User row and every
    FK-cascaded child row -- ProjectMember, Session, UserPreference,
    NotificationPreference -- stay in place; nothing is actually
    deleted) and revokes every Session, logging the account out
    everywhere immediately. Reversing this (re-activation) is left to a
    future admin/support flow, matching the task brief's "soft delete
    ready" wording."""
    if not verify_password(payload.current_password, current_user.password_hash or ""):
        raise HTTPException(status_code=401, detail="Incorrect password")

    current_user.status = models.UserStatus.deactivated
    current_user.updated_at = utc_now()
    db.query(models.Session).filter(models.Session.user_id == current_user.id, models.Session.revoked.is_(False)).update(
        {"revoked": True}
    )
    db.commit()

    log_activity_event(
        db,
        f"{current_user.display_name or current_user.username} deactivated their account",
        icon="user-x",
        user_id=current_user.id,
        action="deactivated",
        entity_type="user",
        entity_id=current_user.id,
    )
    return None


# ======================================================================
# Change password
# ======================================================================

@router.post("/change-password", status_code=204)
def change_password(
    payload: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash or ""):
        raise HTTPException(status_code=401, detail="Incorrect current password")

    try:
        validate_password_strength(payload.new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    current_user.password_hash = hash_password(payload.new_password)
    current_user.updated_at = utc_now()
    # Revoking every session forces re-login everywhere after a password
    # change, the standard defense against "attacker already has a live
    # session using the old password."
    db.query(models.Session).filter(models.Session.user_id == current_user.id, models.Session.revoked.is_(False)).update(
        {"revoked": True}
    )
    db.commit()

    log_activity_event(
        db,
        f"{current_user.display_name or current_user.username} changed their password",
        icon="key",
        user_id=current_user.id,
        action="password_changed",
        entity_type="user",
        entity_id=current_user.id,
    )
    return None


# ======================================================================
# Password reset
# ======================================================================

@router.post("/password-reset/request", response_model=schemas.PasswordResetRequestOut)
def request_password_reset(payload: schemas.PasswordResetRequest, db: DBSession = Depends(get_db)):
    """Issues a password-reset token and stores it (never the raw token,
    only its... actually the raw token IS stored here since it must be
    matched back exactly on confirm and is single-use/short-lived, unlike
    a refresh token which is long-lived -- see model column comment).
    Always returns the same generic message whether or not the email
    matched a User, so this endpoint can't be used to enumerate
    registered accounts. Sends the actual reset email via `email_utils`
    when SMTP is configured; otherwise falls back to returning the raw
    token in the response, gated behind `AUTH_DEBUG_EXPOSE_TOKENS`, so
    local/dev testing isn't blocked on a mail server that doesn't exist."""
    import os

    user = db.query(models.User).filter(models.User.email == payload.email).first()
    debug_token = None
    if user and user.auth_provider == models.AuthProvider.local:
        token = generate_opaque_token(32)
        user.password_reset_token = token
        user.password_reset_expires_at = utc_now() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
        db.commit()
        log_activity_event(
            db,
            f"Password reset requested for {user.email}",
            icon="key",
            user_id=user.id,
            action="password_reset_requested",
            entity_type="user",
            entity_id=user.id,
        )
        sent = email_utils.send_password_reset_email(user.email, user.display_name or user.username, token)
        if not sent and os.environ.get("AUTH_DEBUG_EXPOSE_TOKENS") == "true":
            debug_token = token

    return schemas.PasswordResetRequestOut(debug_reset_token=debug_token)


@router.post("/password-reset/confirm", status_code=204)
def confirm_password_reset(payload: schemas.PasswordResetConfirm, db: DBSession = Depends(get_db)):
    user = db.query(models.User).filter(models.User.password_reset_token == payload.token).first()
    if not user or not user.password_reset_expires_at or user.password_reset_expires_at < utc_now():
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token")

    try:
        validate_password_strength(payload.new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    user.updated_at = utc_now()
    db.query(models.Session).filter(models.Session.user_id == user.id, models.Session.revoked.is_(False)).update(
        {"revoked": True}
    )
    db.commit()

    log_activity_event(
        db,
        f"{user.display_name or user.username} reset their password",
        icon="key",
        user_id=user.id,
        action="password_reset",
        entity_type="user",
        entity_id=user.id,
    )
    return None


# ======================================================================
# Email verification
# ======================================================================

@router.post("/email-verification/request", response_model=schemas.EmailVerificationRequestOut)
def request_email_verification(
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Sends a real verification email via `email_utils` when SMTP is
    configured. Otherwise falls back to returning the raw token in the
    response, gated behind `AUTH_DEBUG_EXPOSE_TOKENS`, so local/dev
    testing isn't blocked on a mail server that doesn't exist."""
    import os

    if current_user.email_verified:
        return schemas.EmailVerificationRequestOut(message="Your email is already verified.")

    sent = _issue_and_send_verification_token(db, current_user)
    if sent:
        return schemas.EmailVerificationRequestOut(message="Check your email for a verification link.")

    debug_token = (
        current_user.email_verification_token
        if os.environ.get("AUTH_DEBUG_EXPOSE_TOKENS") == "true"
        else None
    )
    return schemas.EmailVerificationRequestOut(debug_verification_token=debug_token)


@router.post("/email-verification/confirm", response_model=schemas.UserOut)
def confirm_email_verification(payload: schemas.EmailVerificationConfirm, db: DBSession = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email_verification_token == payload.token).first()
    if (
        not user
        or not user.email_verification_expires_at
        or user.email_verification_expires_at < utc_now()
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    user.updated_at = utc_now()
    db.commit()
    db.refresh(user)

    log_activity_event(
        db,
        f"{user.display_name or user.username} verified their email",
        icon="check-circle",
        user_id=user.id,
        action="email_verified",
        entity_type="user",
        entity_id=user.id,
    )
    return schemas.UserOut.model_validate(user)


# ======================================================================
# Google Sign-In
# ======================================================================

@router.post("/google", response_model=schemas.TokenResponse)
def google_login(payload: schemas.GoogleAuthRequest, db: DBSession = Depends(get_db)):
    """Verifies a Google Identity Services ID token (the `credential` the
    frontend's Google button hands back) against Google's public keys,
    then finds-or-creates a User keyed on the token's `sub` claim and
    issues the same access/refresh token pair as a normal login/register.

    Requires `GOOGLE_CLIENT_ID` to be set (the OAuth 2.0 Web Client ID
    from Google Cloud Console) -- the token's `aud` claim must match it,
    which is what stops a token minted for a *different* app from being
    replayed here. No password is ever set for accounts created this
    way (`password_hash` stays null, same as any other non-local
    `auth_provider`)."""
    import os

    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured on this server")

    try:
        idinfo = google_id_token.verify_oauth2_token(payload.id_token, google_requests.Request(), client_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid Google credential issuer")
    if not idinfo.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Your Google account's email isn't verified")

    google_sub = idinfo["sub"]
    email = idinfo["email"]
    name = idinfo.get("name") or email.split("@")[0]
    is_new_user = False

    user = (
        db.query(models.User)
        .filter(models.User.auth_provider == models.AuthProvider.google, models.User.external_auth_id == google_sub)
        .first()
    )

    if not user:
        # Someone may have registered locally with this email already --
        # link the Google identity to that existing account instead of
        # erroring or creating a duplicate. Same "email is the anchor"
        # reasoning project_helpers.get_or_create_user_by_email already
        # uses for invitation-created users.
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.auth_provider = models.AuthProvider.google
            user.external_auth_id = google_sub
            user.email_verified = True
            user.updated_at = utc_now()
        else:
            is_new_user = True
            user = models.User(
                username=_unique_username_from_email(db, email),
                email=email,
                display_name=name,
                auth_provider=models.AuthProvider.google,
                external_auth_id=google_sub,
                email_verified=True,
                status=models.UserStatus.active,
            )
            db.add(user)
        db.commit()
        db.refresh(user)

    if user.status == models.UserStatus.suspended:
        raise HTTPException(status_code=403, detail="This account has been suspended")
    if user.status == models.UserStatus.deactivated:
        raise HTTPException(status_code=403, detail="This account has been deactivated")

    user.last_seen_at = utc_now()
    if user.status == models.UserStatus.invited:
        user.status = models.UserStatus.active
    db.commit()
    db.refresh(user)

    tokens = _issue_tokens(db, user, device=payload.device, platform=payload.platform, browser=payload.browser)

    log_activity_event(
        db,
        f"{user.display_name or user.username} {'signed up' if is_new_user else 'logged in'} with Google",
        icon="user-plus" if is_new_user else "log-in",
        user_id=user.id,
        action="registered" if is_new_user else "login",
        entity_type="user",
        entity_id=user.id,
    )
    return tokens
