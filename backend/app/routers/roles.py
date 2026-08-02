"""
CRUD for `Role` -- a named, reusable bundle of permission keys (see
ARCHITECTURE.md "Role-Based Access Control (RBAC)"). Four system roles
(Owner/Admin/Member/Viewer, `is_system=True`) are seeded in
`main.py::_seed_collaboration_if_empty` and protected here from
deletion/renaming; project-specific custom roles (`project_id` set) are
fully editable by that project's Admin/Owner (see `project_helpers.is_admin`).
Global catalog mutations (`project_id` unset) require only
authentication -- there is no separate "platform admin" concept in this
app, per the "Do NOT introduce Workspace" architectural rule.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..activity_log import log_activity
from ..auth_dependencies import get_current_user
from ..project_helpers import is_admin

router = APIRouter(prefix="/api/roles", tags=["roles"])


def serialize_role(role: models.Role) -> schemas.RoleOut:
    return schemas.RoleOut.model_validate(
        {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "is_system": role.is_system,
            "project_id": role.project_id,
            "permission_keys": json.loads(role.permission_keys or "[]"),
            "created_at": role.created_at,
            "updated_at": role.updated_at,
        }
    )


def get_role_or_404(db: Session, role_id: str) -> models.Role:
    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


def _validate_permission_keys(db: Session, keys: List[str]) -> None:
    if not keys:
        return
    known = {p.key for p in db.query(models.Permission).filter(models.Permission.key.in_(keys)).all()}
    unknown = [k for k in keys if k not in known]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown permission key(s): {', '.join(unknown)}")


@router.get("", response_model=List[schemas.RoleOut])
def list_roles(
    project_id: Optional[str] = None,
    include_global: bool = Query(default=True, description="Include global (project_id=NULL) roles alongside project-scoped ones"),
    db: Session = Depends(get_db),
):
    """Lists roles. `project_id=None` (default) returns every global +
    project-scoped role; passing `project_id` returns that project's
    custom roles plus (by default) the four global ones, since those
    are always available to every project."""
    query = db.query(models.Role)
    if project_id:
        if include_global:
            query = query.filter((models.Role.project_id == project_id) | (models.Role.project_id.is_(None)))
        else:
            query = query.filter(models.Role.project_id == project_id)
    return [serialize_role(r) for r in query.order_by(models.Role.is_system.desc(), models.Role.name).all()]


@router.get("/{role_id}", response_model=schemas.RoleOut)
def get_role(role_id: str, db: Session = Depends(get_db)):
    return serialize_role(get_role_or_404(db, role_id))


@router.post("", response_model=schemas.RoleOut, status_code=201)
def create_role(
    payload: schemas.RoleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.is_system:
        raise HTTPException(status_code=422, detail="Custom roles cannot be marked as system roles")
    if payload.project_id:
        if not db.query(models.Project).filter(models.Project.id == payload.project_id).first():
            raise HTTPException(status_code=404, detail="Project not found")
        if not is_admin(db, payload.project_id, current_user.id):
            raise HTTPException(status_code=403, detail="Only a project Admin or Owner can create roles for this project")
    _validate_permission_keys(db, payload.permission_keys)

    data = payload.model_dump()
    keys = data.pop("permission_keys")
    role = models.Role(**data, permission_keys=json.dumps(keys))
    db.add(role)
    db.commit()
    db.refresh(role)
    log_activity(db, f'Created role "{role.name}"', icon="shield")
    return serialize_role(role)


@router.patch("/{role_id}", response_model=schemas.RoleOut)
def update_role(
    role_id: str,
    payload: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    role = get_role_or_404(db, role_id)
    if role.project_id and not is_admin(db, role.project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only a project Admin or Owner can edit this project's roles")
    data = payload.model_dump(exclude_unset=True)

    if role.is_system and ("name" in data or "project_id" in data):
        raise HTTPException(status_code=403, detail="Built-in system roles cannot be renamed or reassigned to a project")

    if "permission_keys" in data:
        keys = data.pop("permission_keys") or []
        _validate_permission_keys(db, keys)
        role.permission_keys = json.dumps(keys)

    for field, value in data.items():
        setattr(role, field, value)

    import datetime as _dt
    role.updated_at = _dt.datetime.utcnow()
    db.commit()
    db.refresh(role)
    log_activity(db, f'Updated role "{role.name}"', icon="shield")
    return serialize_role(role)


@router.delete("/{role_id}", status_code=204)
def delete_role(
    role_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    role = get_role_or_404(db, role_id)
    if role.is_system:
        raise HTTPException(status_code=403, detail="Built-in system roles cannot be deleted")
    if role.project_id and not is_admin(db, role.project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only a project Admin or Owner can delete this project's roles")

    in_use = db.query(models.ProjectMember).filter(models.ProjectMember.role_id == role_id).count()
    if in_use:
        raise HTTPException(status_code=409, detail=f"Role is assigned to {in_use} project member(s); reassign them first")

    name = role.name
    db.delete(role)
    db.commit()
    log_activity(db, f'Deleted role "{name}"', icon="shield-off")
    return None


@router.post("/{role_id}/permissions", response_model=schemas.RoleOut)
def add_role_permissions(
    role_id: str,
    keys: List[str] = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Assign permissions: adds the given permission keys to the role
    (union, no duplicates)."""
    role = get_role_or_404(db, role_id)
    if role.project_id and not is_admin(db, role.project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only a project Admin or Owner can edit this project's roles")
    _validate_permission_keys(db, keys)
    current = set(json.loads(role.permission_keys or "[]"))
    current.update(keys)
    role.permission_keys = json.dumps(sorted(current))
    db.commit()
    db.refresh(role)
    return serialize_role(role)


@router.delete("/{role_id}/permissions", response_model=schemas.RoleOut)
def remove_role_permissions(
    role_id: str,
    keys: List[str] = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Remove permissions: drops the given permission keys from the role."""
    role = get_role_or_404(db, role_id)
    if role.project_id and not is_admin(db, role.project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only a project Admin or Owner can edit this project's roles")
    current = set(json.loads(role.permission_keys or "[]"))
    current.difference_update(keys)
    role.permission_keys = json.dumps(sorted(current))
    db.commit()
    db.refresh(role)
    return serialize_role(role)
