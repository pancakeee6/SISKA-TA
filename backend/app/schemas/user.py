from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


# --- Request Schemas ---

class UserCreate(BaseModel):
    employee_id: str
    full_name: str
    email: Optional[str] = None
    department: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


# --- Response Schemas ---

class UserResponse(BaseModel):
    id: UUID
    employee_id: str
    full_name: str
    email: Optional[str]
    department: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    page: int
    per_page: int
