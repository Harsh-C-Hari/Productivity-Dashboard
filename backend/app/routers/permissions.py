"""
`Permission` catalog endpoints.

Per the task brief this module's job is read + lookup + validation
("These APIs will later be consumed by authorization middleware"), not
end-user management of the catalog -- so list/get/lookup-by-key are the
primary routes. Create/Update/Delete are included too (the catalog is
explicitly "seedable", per models.py, and `_seed_collaboration_if_empty`
in main.py uses ordinary inserts, not these routes) so the catalog can
still be managed/extended without a direct DB edit, mirroring how every
other entity in this app gets full CRUD even when most usage is
read-heavy.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth_dependencies import get_current_user

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


def get_permission_or_404(db: Session, permission_id: str) -> models.Permission:
    permission = db.query(models.Permission).filter(models.Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    return permission


@router.get("", response_model=List[schemas.PermissionOut])
def list_permissions(
    category: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Permission)
    if category:
        query = query.filter(models.Permission.category == category)
    if q:
        like = f"%{q}%"
        query = query.filter(models.Permission.key.ilike(like) | models.Permission.name.ilike(like))
    return [schemas.PermissionOut.model_validate(p) for p in query.order_by(models.Permission.category, models.Permission.key).all()]


@router.get("/lookup/{key}", response_model=schemas.PermissionOut)
def get_permission_by_key(key: str, db: Session = Depends(get_db)):
    """Permission lookup by key (e.g. `manage_members`) -- the shape a
    future authorization dependency actually wants, rather than an
    opaque row id."""
    permission = db.query(models.Permission).filter(models.Permission.key == key).first()
    if not permission:
        raise HTTPException(status_code=404, detail=f'Permission "{key}" not found')
    return schemas.PermissionOut.model_validate(permission)


@router.get("/{permission_id}", response_model=schemas.PermissionOut)
def get_permission(permission_id: str, db: Session = Depends(get_db)):
    return schemas.PermissionOut.model_validate(get_permission_or_404(db, permission_id))


@router.post("/validate", response_model=List[str])
def validate_permission_keys(keys: List[str] = Query(...), db: Session = Depends(get_db)):
    """Permission validation helper: given candidate keys (as used by
    `Role.permission_keys`/`ProjectMember.permission_overrides`), returns
    the subset that are NOT valid, known catalog keys -- an empty list
    means every key is valid. Used by roles.py/project_members.py before
    persisting a permission_keys/permission_overrides list."""
    if not keys:
        return []
    known = {p.key for p in db.query(models.Permission).filter(models.Permission.key.in_(keys)).all()}
    return [k for k in keys if k not in known]


@router.post("", response_model=schemas.PermissionOut, status_code=201)
def create_permission(
    payload: schemas.PermissionCreate,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(get_current_user),
):
    if db.query(models.Permission).filter(models.Permission.key == payload.key).first():
        raise HTTPException(status_code=409, detail=f'Permission key "{payload.key}" already exists')
    permission = models.Permission(**payload.model_dump())
    db.add(permission)
    db.commit()
    db.refresh(permission)
    return schemas.PermissionOut.model_validate(permission)


@router.patch("/{permission_id}", response_model=schemas.PermissionOut)
def update_permission(
    permission_id: str,
    payload: schemas.PermissionUpdate,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(get_current_user),
):
    permission = get_permission_or_404(db, permission_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(permission, field, value)
    db.commit()
    db.refresh(permission)
    return schemas.PermissionOut.model_validate(permission)


@router.delete("/{permission_id}", status_code=204)
def delete_permission(
    permission_id: str,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(get_current_user),
):
    """Deleting a Permission does not retroactively strip it out of any
    Role.permission_keys/ProjectMember.permission_overrides JSON lists
    (there's no FK to cascade, by design -- see models.py). A stale key
    left in one of those lists simply matches nothing going forward;
    `validate_permission_keys` above is how callers detect that."""
    permission = get_permission_or_404(db, permission_id)
    db.delete(permission)
    db.commit()
    return None
