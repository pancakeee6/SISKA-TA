# SISKA - Sistem Kehadiran SPA dengan AI Interaktif

Sistem absensi modern berbasis website yang terintegrasi dengan AI Face Recognition.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + Tailwind CSS 4 |
| Backend | FastAPI + SQLAlchemy 2.0 (async) |
| Database | PostgreSQL |
| State | Zustand |
| AI | External AI Face Recognition API |

## Quick Start

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend akan berjalan di `http://localhost:5173`

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Backend akan berjalan di `http://localhost:8000`
API docs di `http://localhost:8000/docs`

## Project Structure

```
siska/
├── frontend/          # React SPA (modules: attendance, admin, auth)
├── backend/           # FastAPI (clean architecture)
└── docs/              # Documentation
```

## Routes

| URL | Deskripsi |
|-----|-----------|
| `/attendance` | Halaman kiosk absensi (kamera + AI) |
| `/login` | Login admin |
| `/admin` | Dashboard admin |
| `/admin/users` | Manajemen user |
| `/admin/attendance` | Riwayat kehadiran |
| `/admin/faces` | Manajemen data wajah |
