import json
import os
from pydantic import BaseModel
from typing import List

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "settings.json")

class ShiftSetting(BaseModel):
    id: str
    name: str
    start_time: str
    end_time: str

class AppSettings(BaseModel):
    shifts: List[ShiftSetting]

DEFAULT_SETTINGS = AppSettings(
    shifts=[
        ShiftSetting(id="shift_1", name="Shift 1", start_time="08:00", end_time="15:00"),
        ShiftSetting(id="shift_2", name="Shift 2", start_time="15:00", end_time="21:00"),
    ]
)

def get_settings() -> AppSettings:
    if not os.path.exists(SETTINGS_FILE):
        _save_settings(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS
    try:
        with open(SETTINGS_FILE, "r") as f:
            data = json.load(f)
            return AppSettings(**data)
    except Exception:
        return DEFAULT_SETTINGS

def update_settings(new_settings: AppSettings) -> AppSettings:
    _save_settings(new_settings)
    return new_settings

def _save_settings(settings: AppSettings):
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        # Compatibility with pydantic v1 (dict()) and v2 (model_dump())
        data = settings.dict() if hasattr(settings, "dict") else settings.model_dump()
        json.dump(data, f, indent=4)
