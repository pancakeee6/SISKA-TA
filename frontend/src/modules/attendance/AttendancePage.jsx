import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { Camera, CheckCircle, XCircle, Scan, Clock, User, Wifi, WifiOff, Maximize, Minimize } from 'lucide-react'
import attendanceApi from './services/attendanceApi'

const STATUS = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  RECOGNIZED: 'recognized',
  UNRECOGNIZED: 'unrecognized',
  ERROR: 'error',
  NO_CAMERA: 'no_camera',
}

// Auto-capture interval in ms
const CAPTURE_INTERVAL = 4000
// How long to show result before resetting
const RESULT_DISPLAY_MS = 5000

export default function AttendancePage() {
  const webcamRef = useRef(null)
  const timerRef = useRef(null)

  const [status, setStatus] = useState(STATUS.IDLE)
  const [result, setResult] = useState(null) // { user_name, event_type, status, late }
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cameraReady, setCameraReady] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // Track fullscreen state
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  // F11 keyboard shortcut
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'F11') {
        e.preventDefault()
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleFullscreen])

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Convert base64 data URL to Blob
  const dataURLtoBlob = (dataURL) => {
    const parts = dataURL.split(',')
    const mime = parts[0].match(/:(.*?);/)[1]
    const binary = atob(parts[1])
    const array = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i)
    }
    return new Blob([array], { type: mime })
  }

  // Capture and send to API
  const captureAndRecognize = useCallback(async () => {
    if (!webcamRef.current || isCapturing) return

    const imageSrc = webcamRef.current.getScreenshot()
    if (!imageSrc) return

    setIsCapturing(true)
    setStatus(STATUS.SCANNING)

    try {
      const blob = dataURLtoBlob(imageSrc)
      const res = await attendanceApi.recognize(blob)
      const data = res.data

      if (data.status === 'recognized' && data.faces?.length > 0) {
        const face = data.faces[0]
        setResult(face)
        setStatus(STATUS.RECOGNIZED)

        // Speak greeting
        speakGreeting(face)
      } else {
        setResult(null)
        setStatus(STATUS.UNRECOGNIZED)
      }
    } catch (err) {
      console.error('Recognition error:', err)
      setResult(null)
      setStatus(STATUS.ERROR)
    }

    // Auto-reset after showing result
    setTimeout(() => {
      setStatus(STATUS.IDLE)
      setResult(null)
      setIsCapturing(false)
    }, RESULT_DISPLAY_MS)
  }, [isCapturing])

  // Auto-capture loop
  useEffect(() => {
    if (cameraReady && status === STATUS.IDLE && !isCapturing) {
      timerRef.current = setInterval(() => {
        captureAndRecognize()
      }, CAPTURE_INTERVAL)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [cameraReady, status, isCapturing, captureAndRecognize])

  // Voice greeting using Web Speech API
  const speakGreeting = (face) => {
    if (!('speechSynthesis' in window)) return

    const eventText = face.event_type === 'IN' ? 'Selamat datang' : 'Sampai jumpa'
    const lateText = face.late ? ', Anda terlambat' : ''
    const text = `${eventText}, ${face.user_name}${lateText}`

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'id-ID'
    utterance.rate = 0.9
    utterance.pitch = 1
    speechSynthesis.speak(utterance)
  }

  // Manual capture button
  const handleManualCapture = () => {
    if (!isCapturing) {
      captureAndRecognize()
    }
  }

  // Format time
  const timeStr = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const dateStr = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="h-screen w-screen bg-[#07080d] flex flex-col items-center justify-center overflow-hidden relative select-none">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[180px] transition-all duration-1000 ${
            status === STATUS.RECOGNIZED
              ? 'bg-emerald-500/15'
              : status === STATUS.UNRECOGNIZED || status === STATUS.ERROR
                ? 'bg-red-500/10'
                : status === STATUS.SCANNING
                  ? 'bg-indigo-500/12'
                  : 'bg-indigo-500/5'
          }`}
        />
      </div>

      {/* Top bar — clock & status */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">SISKA</h1>
            <p className="text-slate-500 text-[10px] mt-0.5">Sistem Kehadiran</p>
          </div>
        </div>

        <div className="text-right flex items-center gap-4">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? 'Keluar fullscreen (F11)' : 'Fullscreen (F11)'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <div>
            <p className="text-3xl font-mono font-bold text-white tracking-wider">{timeStr}</p>
            <p className="text-slate-500 text-xs mt-0.5">{dateStr}</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Camera viewport */}
        <div className="relative mb-6">
          {/* Outer ring with status glow */}
          <div
            className={`relative w-72 h-72 rounded-full p-1.5 transition-all duration-700 ${
              status === STATUS.SCANNING
                ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-500 animate-spin-slow shadow-[0_0_60px_rgba(99,102,241,0.3)]'
                : status === STATUS.RECOGNIZED
                  ? 'bg-gradient-to-br from-emerald-500 to-green-500 shadow-[0_0_60px_rgba(16,185,129,0.4)]'
                  : status === STATUS.UNRECOGNIZED || status === STATUS.ERROR
                    ? 'bg-gradient-to-br from-red-500 to-rose-500 shadow-[0_0_60px_rgba(239,68,68,0.3)]'
                    : 'bg-gradient-to-br from-slate-700 to-slate-800'
            }`}
          >
            {/* Camera feed (circular) */}
            <div className="w-full h-full rounded-full overflow-hidden bg-black">
              {status !== STATUS.NO_CAMERA ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.85}
                  videoConstraints={{
                    width: 480,
                    height: 480,
                    facingMode: 'user',
                  }}
                  onUserMedia={() => setCameraReady(true)}
                  onUserMediaError={() => setStatus(STATUS.NO_CAMERA)}
                  mirrored
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                  <Camera className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-xs">Kamera tidak tersedia</p>
                </div>
              )}
            </div>
          </div>

          {/* Scanning overlay */}
          {status === STATUS.SCANNING && (
            <div className="absolute inset-0 rounded-full flex items-center justify-center">
              <div className="absolute inset-3 rounded-full border-2 border-indigo-400/30 animate-ping" />
              <div className="absolute inset-6 rounded-full border border-indigo-400/20 animate-pulse" />
            </div>
          )}

          {/* Corner brackets (scanning indicator) */}
          {(status === STATUS.IDLE || status === STATUS.SCANNING) && cameraReady && (
            <div className="absolute inset-8 pointer-events-none">
              {/* Top-left */}
              <div className="absolute top-0 left-6 w-8 h-8 border-t-2 border-l-2 border-indigo-400/50 rounded-tl-lg" />
              {/* Top-right */}
              <div className="absolute top-0 right-6 w-8 h-8 border-t-2 border-r-2 border-indigo-400/50 rounded-tr-lg" />
              {/* Bottom-left */}
              <div className="absolute bottom-0 left-6 w-8 h-8 border-b-2 border-l-2 border-indigo-400/50 rounded-bl-lg" />
              {/* Bottom-right */}
              <div className="absolute bottom-0 right-6 w-8 h-8 border-b-2 border-r-2 border-indigo-400/50 rounded-br-lg" />
            </div>
          )}
        </div>

        {/* Status & Result */}
        <div className="text-center min-h-[140px] flex flex-col items-center justify-center">
          {/* IDLE */}
          {status === STATUS.IDLE && cameraReady && (
            <div className="animate-fade-in">
              <p className="text-slate-400 text-lg mb-1">Arahkan wajah Anda ke kamera</p>
              <p className="text-slate-600 text-sm">Deteksi otomatis setiap {CAPTURE_INTERVAL / 1000} detik</p>
              <button
                onClick={handleManualCapture}
                className="mt-5 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600
                           hover:from-indigo-500 hover:to-purple-500
                           text-white text-sm font-medium rounded-2xl
                           transition-all shadow-lg shadow-indigo-500/20
                           hover:shadow-indigo-500/30 active:scale-95 cursor-pointer
                           inline-flex items-center gap-2"
              >
                <Scan className="w-4 h-4" />
                Absen Sekarang
              </button>
            </div>
          )}

          {/* SCANNING */}
          {status === STATUS.SCANNING && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 justify-center mb-2">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-indigo-400 text-lg font-medium">Memindai wajah...</p>
              <p className="text-slate-600 text-sm mt-1">Mohon tetap diam</p>
            </div>
          )}

          {/* RECOGNIZED */}
          {status === STATUS.RECOGNIZED && result && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-center gap-2 mb-3">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
                <span className="text-emerald-400 text-lg font-semibold">
                  {result.event_type === 'IN' ? 'Check In' : 'Check Out'} Berhasil
                </span>
              </div>

              <div className="bg-white/[0.04] backdrop-blur rounded-2xl px-8 py-5 border border-emerald-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    {result.user_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="text-left">
                    <p className="text-white text-xl font-bold">{result.user_name}</p>
                    <p className="text-slate-400 text-sm">
                      {result.event_type === 'IN' ? 'Masuk' : 'Keluar'} — {timeStr}
                    </p>
                  </div>
                </div>

                {result.late && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400 text-sm font-medium">Terlambat</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* UNRECOGNIZED */}
          {status === STATUS.UNRECOGNIZED && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-center gap-2 mb-2">
                <XCircle className="w-7 h-7 text-red-400" />
                <span className="text-red-400 text-lg font-semibold">Wajah Tidak Dikenali</span>
              </div>
              <p className="text-slate-500 text-sm">Pastikan wajah Anda sudah terdaftar</p>
              <p className="text-slate-600 text-xs mt-1">Hubungi admin jika belum terdaftar</p>
            </div>
          )}

          {/* ERROR */}
          {status === STATUS.ERROR && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-center gap-2 mb-2">
                <WifiOff className="w-6 h-6 text-red-400" />
                <span className="text-red-400 text-lg font-semibold">Koneksi Gagal</span>
              </div>
              <p className="text-slate-500 text-sm">Tidak dapat terhubung ke server</p>
            </div>
          )}

          {/* NO CAMERA */}
          {status === STATUS.NO_CAMERA && (
            <div className="animate-fade-in">
              <p className="text-red-400 text-lg font-medium mb-1">Kamera Tidak Terdeteksi</p>
              <p className="text-slate-500 text-sm">Pastikan kamera terhubung dan izin diberikan</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-5 py-2 text-sm text-slate-300 border border-white/10 rounded-xl
                           hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 z-10">
        <div className="flex items-center gap-2">
          {cameraReady ? (
            <>
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-slate-500 text-xs">Kamera aktif</span>
            </>
          ) : status !== STATUS.NO_CAMERA ? (
            <>
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-slate-500 text-xs">Menghubungkan kamera...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              <span className="text-slate-500 text-xs">Kamera tidak tersedia</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-600 text-xs">SISKA v1.0</span>
        </div>
      </div>

      {/* Custom animation keyframes via inline style */}
      <style>{`
        @keyframes spin-slow {
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}
