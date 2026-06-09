"""
AI Service — integration with ML API (elsann-api-absensi.hf.space)

Temporary compatibility layer: SISKA uses this service for
face enrollment and recognition only. Embedding storage is
managed entirely on the ML API side.
"""

import logging
import httpx
from fastapi import UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)

# Cached ML API admin token
_ml_token: str | None = None


async def _get_ml_token() -> str:
    """Login to ML API and cache the auth token."""
    global _ml_token
    if _ml_token:
        return _ml_token

    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            f"{settings.AI_API_URL}/admin/login",
            json={
                "username": settings.ML_ADMIN_USERNAME,
                "password": settings.ML_ADMIN_PASSWORD,
            },
        )
        res.raise_for_status()
        data = res.json()
        _ml_token = data.get("token") or data.get("access_token")
        logger.info("[ML API] Login berhasil")
        return _ml_token


def _clear_ml_token():
    """Clear cached token so next call re-authenticates."""
    global _ml_token
    _ml_token = None


async def _ml_request(method: str, path: str, **kwargs) -> httpx.Response:
    """Make an authenticated request to ML API with auto-retry on 401."""
    token = await _get_ml_token()

    async with httpx.AsyncClient(timeout=kwargs.pop("timeout", 15.0)) as client:
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {token}"

        res = await getattr(client, method)(
            f"{settings.AI_API_URL}{path}",
            headers=headers,
            **kwargs,
        )

        # If 401/403, token might be expired — retry once
        if res.status_code in (401, 403):
            _clear_ml_token()
            token = await _get_ml_token()
            headers["Authorization"] = f"Bearer {token}"

            async with httpx.AsyncClient(timeout=15.0) as retry_client:
                res = await getattr(retry_client, method)(
                    f"{settings.AI_API_URL}{path}",
                    headers=headers,
                    **kwargs,
                )

        res.raise_for_status()
        return res


# ─── Face Recognition (Public — used by attendance kiosk) ────────────

async def recognize_face(image_file: UploadFile) -> dict:
    """Send image to ML API for face recognition (attendance).

    Calls POST /v1/recognize_multi with device headers.
    """
    # Baca seluruh file ke memory (bytes) agar httpx tidak bermasalah
    # saat membaca SpooledTemporaryFile secara async.
    content = await image_file.read()
    await image_file.seek(0)
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{settings.AI_API_URL}/v1/recognize_multi",
            files={"file": (image_file.filename, content, image_file.content_type)},
            headers={
                "x-device-id": settings.DEVICE_ID,
                "x-device-token": settings.DEVICE_TOKEN,
            },
        )
        response.raise_for_status()
        return response.json()


# ─── Person Management (Admin — synced with SISKA users) ─────────────

async def create_person(name: str) -> int:
    """Create a person in ML API. Returns the ML person_id."""
    res = await _ml_request("post", "/admin/persons", json={"name": name})
    data = res.json()
    person_id = data.get("id") or data.get("person_id")
    logger.info(f"[ML API] Person created: {name} → id={person_id}")
    return person_id


async def delete_person(person_id: int) -> None:
    """Delete a person from ML API."""
    try:
        await _ml_request("delete", f"/admin/persons/{person_id}")
        logger.info(f"[ML API] Person deleted: id={person_id}")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.warning(f"[ML API] Person id={person_id} not found, skipping delete")
        else:
            raise


async def list_persons() -> list:
    """List all persons registered in ML API."""
    res = await _ml_request("get", "/admin/persons")
    return res.json()


# ─── Face Enrollment (Admin — upload face photos) ────────────────────

async def enroll_face(person_id: int, image_file: UploadFile) -> dict:
    """Upload face image to ML API for enrollment.

    Calls POST /admin/persons/{person_id}/enroll with the image file.
    Embedding extraction and storage is handled by the ML API.
    """
    res = await _ml_request(
        "post",
        f"/admin/persons/{person_id}/enroll",
        files={"files": (image_file.filename, image_file.file, image_file.content_type)},
    )
    data = res.json()
    logger.info(f"[ML API] Face enrolled for person_id={person_id}")
    return data


async def reset_attendance() -> dict:
    """Reset attendance in ML API (Debug)."""
    res = await _ml_request("post", "/admin/reset_attendance")
    logger.info("[ML API] Attendance reset triggered via admin")
    return res.json()

