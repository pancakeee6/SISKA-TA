from fastapi import APIRouter, Depends
from app.api.deps import get_current_admin
from app.services.settings_service import get_settings, update_settings, AppSettings

router = APIRouter()

@router.get("/shifts", response_model=AppSettings)
async def read_shift_settings(_admin=Depends(get_current_admin)):
    """Get current shift settings."""
    return get_settings()

@router.put("/shifts", response_model=AppSettings)
async def update_shift_settings(new_settings: AppSettings, _admin=Depends(get_current_admin)):
    """Update shift settings."""
    return update_settings(new_settings)
