from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import json
import asyncio

from app.core.config import settings
from app.core.sse import sse_manager
from app.api.v1 import auth, users, attendance, dashboard, faces, tts

# Import all models so SQLAlchemy resolves relationships at startup
import app.models.admin  # noqa: F401
import app.models.user  # noqa: F401
import app.models.face  # noqa: F401
import app.models.attendance  # noqa: F401
import app.models.activity_log  # noqa: F401

app = FastAPI(
    title="SISKA API",
    description="Sistem Kehadiran - Backend API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(attendance.router, prefix="/api/v1/attendance", tags=["Attendance"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(faces.router, prefix="/api/v1/faces", tags=["Face Data"])
app.include_router(tts.router, prefix="/api/v1/tts", tags=["TTS"])

# Serve uploaded face images as static files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/api/v1/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# SSE endpoint for realtime attendance updates
@app.get("/stream/attendance")
async def stream_attendance(request: Request):
    queue = sse_manager.connect()

    async def event_generator():
        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break
                
                # Wait for new message in the queue
                message = await queue.get()
                yield f"data: {json.dumps(message)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_manager.disconnect(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/", tags=["Root"])
async def root():
    return {"message": "SISKA API is running", "version": "1.0.0"}


@app.get("/health", tags=["Root"])
async def health_check():
    return {"status": "healthy"}
