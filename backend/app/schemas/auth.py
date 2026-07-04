from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class AdminUpdate(BaseModel):
    full_name: str | None = None
    username: str | None = None
    avatar: str | None = None
    current_password: str | None = None
    new_password: str | None = None
