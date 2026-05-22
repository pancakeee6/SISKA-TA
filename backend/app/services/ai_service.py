import httpx
from fastapi import UploadFile

from app.core.config import settings


async def recognize_face(image_file: UploadFile) -> dict:
    """Send image to AI API for face recognition (attendance)."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.AI_API_URL}/v1/recognize_multi",
            files={"file": (image_file.filename, image_file.file, image_file.content_type)},
            headers={
                "x-device-id": settings.DEVICE_ID,
                "x-device-token": settings.DEVICE_TOKEN,
            },
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()


async def extract_embedding(image_file: UploadFile) -> list:
    """Send image to AI API, receive embedding vector for storage."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.AI_API_URL}/v1/extract_embedding",
            files={"file": (image_file.filename, image_file.file, image_file.content_type)},
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()
        return data["embedding"]  # list of floats
