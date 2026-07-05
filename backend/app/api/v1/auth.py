from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, AdminUpdate
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login admin and return JWT tokens."""
    # Find admin by username
    result = await db.execute(
        select(Admin).where(Admin.username == request.username)
    )
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(request.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun tidak aktif",
        )

    # Create tokens
    token_data = {"sub": str(admin.id), "username": admin.username}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    """Refresh access token using refresh token."""
    payload = decode_token(request.refresh_token)

    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token tidak valid",
        )

    token_data = {"sub": payload["sub"], "username": payload["username"]}
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout")
async def logout():
    """Logout admin (client-side token removal)."""
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_admin_info(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    """Get current admin info from JWT token."""
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token tidak valid")

    result = await db.execute(
        select(Admin).where(Admin.id == payload["sub"])
    )
    admin = result.scalar_one_or_none()

    if not admin:
        raise HTTPException(status_code=404, detail="Admin tidak ditemukan")

    return {
        "id": str(admin.id),
        "username": admin.username,
        "email": admin.email,
        "full_name": admin.full_name,
        "avatar": admin.avatar,
    }


@router.put("/me")
async def update_current_admin_info(
    request: AdminUpdate,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    """Update current admin profile."""
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token tidak valid")

    result = await db.execute(
        select(Admin).where(Admin.id == payload["sub"])
    )
    admin = result.scalar_one_or_none()

    if not admin:
        raise HTTPException(status_code=404, detail="Admin tidak ditemukan")

    # Update basic info if provided
    if request.full_name is not None:
        admin.full_name = request.full_name
    if request.username is not None:
        # Check if username is already taken
        if request.username != admin.username:
            check_username = await db.execute(select(Admin).where(Admin.username == request.username))
            if check_username.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Username sudah digunakan")
        admin.username = request.username
    if request.avatar is not None:
        admin.avatar = request.avatar

    # Update password if provided
    if request.current_password and request.new_password:
        if not verify_password(request.current_password, admin.password_hash):
            raise HTTPException(status_code=400, detail="Password saat ini salah")
        admin.password_hash = get_password_hash(request.new_password)

    await db.commit()

    return {
        "message": "Profil berhasil diperbarui",
        "admin": {
            "id": str(admin.id),
            "username": admin.username,
            "email": admin.email,
            "full_name": admin.full_name,
            "avatar": admin.avatar,
        }
    }

