# SISKA - Sistem Kehadiran Berbasis AI (Face Recognition)

SISKA (Sistem Kehadiran AI) adalah aplikasi absensi modern yang terintegrasi dengan teknologi *Face Recognition* (pengenalan wajah) secara *real-time*. Sistem ini dirancang untuk memberikan pengalaman presensi yang cepat, aman, dan tanpa sentuhan (*contactless*), dengan dukungan suara sapaan otomatis (*Text-to-Speech*).

## 🚀 Fitur Utama

- **Real-time Face Recognition**: Memindai dan mengenali wajah pengguna secara instan menggunakan kamera perangkat.
- **Contactless & Seamless**: Proses absensi terjadi tanpa sentuhan fisik. Sistem secara otomatis mendeteksi wajah dan mencatat waktu kehadiran (Masuk/Keluar).
- **Auto-Greeting (Text-to-Speech)**: Memberikan respons audio instan saat pengguna berhasil dikenali.
- **Admin Dashboard Terpadu**: Panel manajemen modern untuk memantau kehadiran harian, mendaftarkan wajah baru via webcam, dan mengunduh laporan (CSV).
- **Arsitektur API Terpusat**: Frontend React terhubung secara langsung ke layanan API Machine Learning (seperti Hugging Face Spaces), menjamin proses komputasi AI yang efisien dan responsif.

## 🛠️ Tech Stack

**Frontend (SPA)**
- React 19
- Vite 6
- Tailwind CSS 4
- Zustand (State Management)
- Lucide React (Icons)
- React Webcam

**API & AI Engine (Repositori Terpisah)**
- FastApi / Python API
- Model Face Recognition (DeepFace/FaceNet)

## 📂 Struktur Proyek

```text
siska/
├── frontend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── admin/       # Dashboard, Manajemen Wajah & Riwayat Absensi
│   │   │   ├── attendance/  # Kiosk Scanner Absensi Kamera
│   │   │   └── auth/        # Modul Autentikasi Admin
│   │   ├── shared/          # Komponen UI Global (Layout, Sidebar, Guard)
│   │   └── App.jsx          # Konfigurasi Routing
│   └── .env                 # Environment variables lokal
└── README.md                # Dokumentasi proyek
```

*(Catatan: Folder `backend` versi lama telah dinonaktifkan karena logika utama telah dipindahkan ke API Machine Learning secara langsung).*

## ⚙️ Cara Menjalankan Proyek (Quick Start)

### Prasyarat
- Node.js (v18 atau lebih baru) disarankan menggunakan NVM.
- npm atau yarn

### Langkah Instalasi

1. **Clone repository ini**
   ```bash
   git clone https://github.com/eLsann/siska.git
   cd siska/frontend
   ```

2. **Konfigurasi Environment**
   Salin file `.env.example` (jika ada) atau buat file `.env` di dalam folder `frontend`, lalu atur URL API utama Anda:
   ```env
   VITE_ML_API_URL=https://[ALAMAT-API-ANDA]
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Jalankan Server Development**
   ```bash
   npm run dev
   ```
   Aplikasi akan otomatis berjalan dan dapat diakses di `http://localhost:5173`.

## 🗺️ Struktur Routing (Frontend)

| Path | Akses | Keterangan |
|------|-------|------------|
| `/attendance` | Publik | Halaman utama Scanner Absensi (Siap digunakan sebagai Kiosk) |
| `/login` | Publik | Halaman otorisasi masuk untuk Administrator |
| `/admin` | Admin | Ringkasan statistik kehadiran & log terbaru |
| `/admin/users` | Admin | Kelola direktori pengguna / karyawan |
| `/admin/faces` | Admin | Pendaftaran (*enrollment*) & pengelolaan data wajah pengguna |
| `/admin/attendance`| Admin | Pemantauan riwayat log & ekspor data (CSV) |

## 📝 Lisensi

Aplikasi ini dikembangkan untuk keperluan riset/tugas akhir dan dilisensikan di bawah spesifikasi pengembang. Hak Cipta dilindungi.
