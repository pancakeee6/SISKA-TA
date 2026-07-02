# SISKA - Sistem Kehadiran Berbasis Artificial Intelligence (Face Recognition)

SISKA (Sistem Kehadiran AI) adalah aplikasi presensi modern yang mengintegrasikan teknologi *Computer Vision* dan *Real-Time Face Recognition*. Sistem ini dirancang untuk memberikan pengalaman presensi yang cepat, akurat, dan tanpa sentuhan (*contactless*), lengkap dengan interaksi visual maskot AI dinamis dan sapaan suara otomatis (*Text-to-Speech*).

## Fitur Utama

- **Real-Time Face Recognition**: Mendeteksi dan memverifikasi identitas pengguna secara langsung melalui kamera *kiosk* dengan tingkat akurasi tinggi.
- **Dynamic AI Mascot Interaction**: Dilengkapi dengan maskot interaktif berbasis animasi Rive yang merespons status presensi secara *real-time* (mode siaga normal, tertidur saat *idle*, terbangun saat mendeteksi wajah, dan selebrasi saat presensi berhasil).
- **Contactless Attendance**: Pengguna cukup berdiri di depan kamera tanpa memerlukan sentuhan fisik pada perangkat, mendukung higienitas dan efisiensi antrean.
- **Automated Voice Greeting**: Memberikan konfirmasi audio secara natural (*Text-to-Speech*) setelah identitas pengguna terverifikasi.
- **Admin Dashboard & Management (Light Mode)**: Panel administrasi modern bertema terang (*Light Mode*) yang profesional dan bersih untuk memantau statistik kehadiran secara seketika (*realtime WebSocket*), mengelola direktori pengguna, mendaftarkan sampel wajah baru (*face enrollment*), serta mengekspor laporan riwayat presensi ke format CSV.
- **Multi-Device & Cloud Ready**: Arsitektur basis data terpusat (*Centralized Database*) menggunakan PostgreSQL yang siap dihubungkan dengan berbagai perangkat pemindai (*kiosk STB/kamera*) dan komputer admin baik di satu jaringan LAN maupun melalui *cloud database* (seperti Aiven atau Supabase).

## Arsitektur Sistem & Teknologi

### Frontend (Single Page Application)
- **Framework**: React 19 dengan Vite 6
- **Styling**: Tailwind CSS 4 & Vanilla CSS (Skema Warna Terang Modern / Light Theme)
- **State Management**: Zustand
- **Animation Engine**: Rive (@rive-app/react-canvas) dengan transisi mulus & *auto-sleep*
- **Computer Vision**: face-api.js & React Webcam

### Backend & Machine Learning API
- **Framework**: FastAPI (Python REST API & Realtime WebSocket)
- **AI Engine**: DeepFace / Face Recognition Embeddings
- **Database**: PostgreSQL (Asynchronous via `asyncpg`) / SQLAlchemy

## Struktur Proyek

```text
siska/
├── frontend/
│   ├── src/
│   │   ├── assets/          # Aset visual & file biner animasi Rive (siska.riv)
│   │   ├── modules/
│   │   │   ├── admin/       # Dashboard, Manajemen Wajah & Riwayat Presensi
│   │   │   ├── attendance/  # Kiosk Scanner Presensi & Maskot SISKA
│   │   │   └── auth/        # Autentikasi Administrator
│   │   ├── shared/          # Komponen UI Global & State Management
│   │   └── App.jsx          # Konfigurasi Rute Aplikasi
│   └── package.json
├── backend/
│   ├── app/                 # Layanan REST API & Pemrosesan Biometrik
│   └── requirements.txt
└── README.md
```

## Panduan Instalasi dan Penggunaan

### Prasyarat Sistem
- **Node.js**: Versi 18.x atau lebih baru (disarankan menggunakan LTS)
- **Python**: Versi 3.10 atau lebih baru (untuk layanan backend API)
- **Paket Manajer**: npm atau yarn

### 1. Konfigurasi dan Menjalankan Frontend

1. Masuk ke direktori `frontend`:
   ```bash
   cd frontend
   ```

2. Instal dependensi paket:
   ```bash
   npm install
   ```

3. Konfigurasi variabel lingkungan dengan membuat file `.env` di dalam folder `frontend`:
   ```env
   VITE_ML_API_URL=http://localhost:8000
   ```

4. Jalankan server pengembangan lokal:
   ```bash
   npm run dev
   ```
   Aplikasi frontend dapat diakses melalui browser di `http://localhost:5173`.

### 2. Konfigurasi dan Menjalankan Backend Lokal

1. Masuk ke direktori `backend`:
   ```bash
   cd backend
   ```

2. Buat dan aktifkan *virtual environment*:
   ```bash
   python -m venv venv
   # Pada sistem Windows:
   .\venv\Scripts\activate
   ```

3. Instal dependensi Python:
   ```bash
   pip install -r requirements.txt
   ```

4. Jalankan server FastAPI:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Struktur Rute Aplikasi

| Rute Akses | Hak Akses | Deskripsi |
|---|---|---|
| `/attendance` | Publik | Layar *Kiosk* utama untuk pemindaian wajah dan presensi mandiri |
| `/login` | Publik | Halaman otentikasi masuk bagi Administrator |
| `/admin` | Admin | Panel statistik kehadiran harian dan pemantauan aktivitas log terbaru |
| `/admin/users` | Admin | Manajemen direktori data pengguna / pegawai |
| `/admin/faces` | Admin | Pendaftaran (*enrollment*) dan pembaruan sampel wajah biometrik |
| `/admin/attendance` | Admin | Laporan riwayat kehadiran lengkap dan ekspor data (CSV) |

## Lisensi

Proyek ini dikembangkan untuk keperluan penelitian dan pengembangan sistem presensi biometrik modern. Seluruh hak cipta dilindungi.
