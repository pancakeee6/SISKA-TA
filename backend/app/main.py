from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.websocket import ws_manager
from app.api.v1 import auth, users, attendance, dashboard, faces

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

# Serve uploaded face images as static files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/api/v1/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# WebSocket endpoint for realtime attendance updates
@app.websocket("/ws/attendance")
async def websocket_attendance(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for any client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


@app.get("/", tags=["Root"])
async def root():
    return {"message": "SISKA API is running", "version": "1.0.0"}


@app.get("/health", tags=["Root"])
async def health_check():
    return {"status": "healthy"}
