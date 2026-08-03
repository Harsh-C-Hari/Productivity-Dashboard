"""
Minimal CRUD for `User` rows.

This is *not* an authentication/registration API -- there is no
login, no password verification, no session issuance here (see
AI_HANDOFF.md "Next Planned Modules" for where that lands). It exists
because every other collaboration router (Project Members, Project
Invitations, User Preferences, Notification Preferences) references a
`user_id`/`email`, and `models.User` itself is documented as "usable
standalone today" -- something has to be able to create/list/read
that row in the meantime. Mirrors `routers/subjects.py`'s plain-CRUD
shape.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..timeutils import utc_now
from .. import models, schemas
from ..auth_dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


def get_user_or_404(db: Session, user_id: str) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def build_user_summary(db: Session, user: models.User) -> schemas.UserSummary:
    project_count = (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.user_id == user.id, models.ProjectMember.status == models.MemberStatus.active)
        .count()
    )
    owned_project_count = db.query(models.Project).filter(models.Project.owner_id == user.id).count()
    active_session_count = (
        db.query(models.Session)
        .filter(models.Session.user_id == user.id, models.Session.revoked.is_(False))
        .count()
    )
    pending_invitation_count = (
        db.query(models.ProjectInvitation)
        .filter(
            models.ProjectInvitation.email == user.email,
            models.ProjectInvitation.status == models.InvitationStatus.pending,
        )
        .count()
    )
    return schemas.UserSummary(
        user=schemas.UserOut.model_validate(user),
        project_count=project_count,
        owned_project_count=owned_project_count,
        active_session_count=active_session_count,
        pending_invitation_count=pending_invitation_count,
    )


@router.get("", response_model=List[schemas.UserOut])
def list_users(
    q: Optional[str] = None,
    status: Optional[models.UserStatus] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.User)
    if status:
        query = query.filter(models.User.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(models.User.username.ilike(like), models.User.display_name.ilike(like), models.User.email.ilike(like))
        )
    query = query.order_by(models.User.created_at.desc()).offset(offset).limit(limit)
    return [schemas.UserOut.model_validate(u) for u in query.all()]


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db: Session = Depends(get_db), _current_user: models.User = Depends(get_current_user)):
    return schemas.UserOut.model_validate(get_user_or_404(db, user_id))


@router.get("/{user_id}/summary", response_model=schemas.UserSummary)
def get_user_summary(user_id: str, db: Session = Depends(get_db), _current_user: models.User = Depends(get_current_user)):
    return build_user_summary(db, get_user_or_404(db, user_id))


@router.post("", response_model=schemas.UserOut, status_code=201)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = models.User(**payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: str, payload: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Self-service only -- this generic directory CRUD previously had no
    # auth at all, meaning anyone could edit any account (status,
    # auth_provider, email, ...). `/api/auth/me*` already covers
    # legitimate profile self-edits; this endpoint is now restricted to
    # "edit your own row" so it stays usable without becoming an
    # account-takeover surface. There is no admin role modeled anywhere
    # else in this app to carve out a broader exception for.
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own account")
    user = get_user_or_404(db, user_id)
    data = payload.model_dump(exclude_unset=True)

    if "username" in data and data["username"] != user.username:
        if db.query(models.User).filter(models.User.username == data["username"]).first():
            raise HTTPException(status_code=409, detail="Username already taken")
    if "email" in data and data["email"] != user.email:
        if db.query(models.User).filter(models.User.email == data["email"]).first():
            raise HTTPException(status_code=409, detail="Email already registered")

    for field, value in data.items():
        setattr(user, field, value)

    import datetime as _dt
    user.updated_at = _dt.utc_now()
    db.commit()
    db.refresh(user)
    return schemas.UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Same self-service-only restriction as update_user above.
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own account")
    user = get_user_or_404(db, user_id)
    db.delete(user)
    db.commit()
    return None
