from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.api.deps import get_current_admin
from app.models.shift import WorkShift

router = APIRouter()


class ShiftItem(BaseModel):
    id: Optional[int] = None
    name: str
    start_time: str
    end_time: str

    class Config:
        from_attributes = True


class ShiftsPayload(BaseModel):
    shifts: List[ShiftItem]


@router.get("/shifts")
async def get_shifts(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get all work shifts. Seeds default shifts if empty."""
    query = select(WorkShift).order_by(WorkShift.id.asc())
    result = await db.execute(query)
    shifts = result.scalars().all()

    if not shifts:
        # Seed default shifts
        s1 = WorkShift(name="Shift 1 (Pagi/Siang)", start_time="08:00", end_time="15:00")
        s2 = WorkShift(name="Shift 2 (Sore/Malam)", start_time="15:00", end_time="21:00")
        db.add_all([s1, s2])
        await db.commit()
        await db.refresh(s1)
        await db.refresh(s2)
        shifts = [s1, s2]

    return {
        "shifts": [
            {
                "id": s.id,
                "name": s.name,
                "start_time": s.start_time,
                "end_time": s.end_time,
            }
            for s in shifts
        ]
    }


@router.put("/shifts")
async def update_shifts(
    payload: ShiftsPayload,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Sync all work shifts (add, edit, or remove shifts)."""
    # Get existing DB shifts
    query = select(WorkShift)
    result = await db.execute(query)
    existing_shifts = {s.id: s for s in result.scalars().all()}

    kept_ids = set()

    for item in payload.shifts:
        # Check if item has an existing valid DB id
        if item.id and item.id in existing_shifts and item.id < 1000000000:
            # Update existing shift
            shift_obj = existing_shifts[item.id]
            shift_obj.name = item.name
            shift_obj.start_time = item.start_time
            shift_obj.end_time = item.end_time
            kept_ids.add(item.id)
        else:
            # Create new shift
            new_shift = WorkShift(
                name=item.name or "Shift Baru",
                start_time=item.start_time or "08:00",
                end_time=item.end_time or "16:00",
            )
            db.add(new_shift)

    # Delete existing shifts that were removed by admin
    for s_id, s_obj in existing_shifts.items():
        if s_id not in kept_ids:
            await db.delete(s_obj)

    await db.commit()

    # Return updated list
    result = await db.execute(select(WorkShift).order_by(WorkShift.id.asc()))
    updated_shifts = result.scalars().all()
    return {
        "shifts": [
            {
                "id": s.id,
                "name": s.name,
                "start_time": s.start_time,
                "end_time": s.end_time,
            }
            for s in updated_shifts
        ]
    }


@router.post("/shifts")
async def create_shift(
    item: ShiftItem,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Add a new work shift."""
    new_shift = WorkShift(
        name=item.name or "Shift Baru",
        start_time=item.start_time or "08:00",
        end_time=item.end_time or "16:00",
    )
    db.add(new_shift)
    await db.commit()
    await db.refresh(new_shift)
    return {
        "status": "success",
        "shift": {
            "id": new_shift.id,
            "name": new_shift.name,
            "start_time": new_shift.start_time,
            "end_time": new_shift.end_time,
        },
    }


@router.delete("/shifts/{shift_id}")
async def delete_shift(
    shift_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Delete a work shift by ID."""
    query = select(WorkShift).where(WorkShift.id == shift_id)
    result = await db.execute(query)
    shift_obj = result.scalar_one_or_none()

    if not shift_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift tidak ditemukan",
        )

    await db.delete(shift_obj)
    await db.commit()
    return {"status": "success", "message": f"Shift '{shift_obj.name}' berhasil dihapus"}
