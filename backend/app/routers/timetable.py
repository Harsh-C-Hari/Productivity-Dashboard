"""CRUD endpoints for the weekly timetable."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/timetable", tags=["timetable"])


@router.get("", response_model=List[schemas.TimetableSlotOut])
def list_slots(db: Session = Depends(get_db)):
    return db.query(models.TimetableSlot).all()


@router.post("", response_model=schemas.TimetableSlotOut, status_code=201)
def create_slot(payload: schemas.TimetableSlotCreate, db: Session = Depends(get_db)):
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    slot = models.TimetableSlot(**payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.patch("/{slot_id}", response_model=schemas.TimetableSlotOut)
def update_slot(slot_id: str, payload: schemas.TimetableSlotUpdate, db: Session = Depends(get_db)):
    slot = db.query(models.TimetableSlot).filter(models.TimetableSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(slot, field, value)
    if slot.end_time <= slot.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=204)
def delete_slot(slot_id: str, db: Session = Depends(get_db)):
    slot = db.query(models.TimetableSlot).filter(models.TimetableSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    db.delete(slot)
    db.commit()
    return None
