"""CRUD endpoints for the weekly timetable. Personal module: every slot
belongs to the current user via `TimetableSlot.user_id`."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth_dependencies import get_current_user
from ..ownership_helpers import get_owned_or_404, owned_query

router = APIRouter(prefix="/api/timetable", tags=["timetable"])


@router.get("", response_model=List[schemas.TimetableSlotOut])
def list_slots(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return owned_query(db, models.TimetableSlot, current_user.id).all()


@router.post("", response_model=schemas.TimetableSlotOut, status_code=201)
def create_slot(
    payload: schemas.TimetableSlotCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    slot = models.TimetableSlot(**payload.model_dump(), user_id=current_user.id)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.patch("/{slot_id}", response_model=schemas.TimetableSlotOut)
def update_slot(
    slot_id: str,
    payload: schemas.TimetableSlotUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    slot = get_owned_or_404(db, models.TimetableSlot, slot_id, current_user.id, "Slot not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(slot, field, value)
    if slot.end_time <= slot.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=204)
def delete_slot(
    slot_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    slot = get_owned_or_404(db, models.TimetableSlot, slot_id, current_user.id, "Slot not found")
    db.delete(slot)
    db.commit()
    return None
