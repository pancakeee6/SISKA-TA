import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { Camera, CheckCircle, XCircle, Scan, Clock, Wifi, WifiOff, Maximize, Minimize, RefreshCcw } from 'lucide-react'
import attendanceApi from './services/attendanceApi'
import siskaLogo from '@/assets/siska-logo.png'
import siskaMascot from '@/assets/siska-mascot.png'

const STATUS = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  RECOGNIZED: 'recognized',
  UNRECOGNIZED: 'unrecognized',
  ERROR: 'error',
  NO_CAMERA: 'no_camera',
}

const PHASE = {
  WELCOME: 'welcome',
  READY: 'ready',
}

// Auto-capture interval in ms
const CAPTURE_INTERVAL = 4000
// How long to show result before resetting
const RESULT_DISPLAY_MS = 5000

export default function AttendancePage() {
  const webcamRef = useRef(null)
  const timerRef = useRef(null)

  const [phase, setPhase] = useState(PHASE.WELCOME)
  const [welcomeProgress, setWelcomeProgress] = useState(0)
  const [status, setStatus] = useState(STATUS.IDLE)
  const [result, setResult] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cameraReady, setCameraReady] = useState(false)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [todayCount, setTodayCount] = useState(0)

  // Welcome progress animation
  useEffect(() => {
    if (phase !== PHASE.WELCOME) return
    const interval = setInterval(() => {
      setWelcomeProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => setPhase(PHASE.READY), 400)
          return 100
        }
        // Fast at start, slow around 60-85% (simulating camera init), fast at end
        const increment = prev < 40 ? 3 : prev < 75 ? 1.5 : prev < 90 ? 2 : 4
        return Math.min(prev + increment, 100)
      })
    }, 80)
    return () => clearInterval(interval)
  }, [phase])

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
        setTodayCount(prev => prev + 1)
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
    if (phase !== PHASE.READY) return
    if (cameraReady && status === STATUS.IDLE && !isCapturing) {
      timerRef.current = setInterval(() => {
        captureAndRecognize()
      }, CAPTURE_INTERVAL)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, cameraReady, status, isCapturing, captureAndRecognize])

  // Helper to get time-based greeting
  const getTimeGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 10) return 'Selamat pagi'
    if (hour < 15) return 'Selamat siang'
    if (hour < 18) return 'Selamat sore'
    return 'Selamat malam'
  }

  // Voice greeting using Web Speech API with varied sentences
  const speakGreeting = (face) => {
    if (!('speechSynthesis' in window)) return

    const timeGreeting = getTimeGreeting()
    const name = face.user_name || 'Karyawan'
    let text = ''

    // Handle cooldown or other non-ok statuses
    if (face.status && face.status !== 'ok') {
      text = face.audio_text || `Halo ${name}, mohon tunggu sebentar sebelum absen kembali.`
    }
    // Randomized greetings arrays
    else if (face.event_type === 'IN') {
      if (face.late) {
        const lateGreetings = [
          `${timeGreeting} ${name}. Absen berhasil, namun Anda tercatat terlambat hari ini.`,
          `Halo ${name}. Anda datang terlambat, tolong lebih tepat waktu besok ya.`,
          `Absen masuk berhasil. ${timeGreeting} ${name}, jangan terlambat lagi ya.`
        ]
        text = lateGreetings[Math.floor(Math.random() * lateGreetings.length)]
      } else {
        const inGreetings = [
          `${timeGreeting} ${name}. Selamat bekerja dan semoga harimu menyenangkan!`,
          `Halo ${name}, absen masuk berhasil dicatat. Semangat untuk hari ini!`,
          `Selamat datang ${name}. Jangan lupa tersenyum dan selamat bertugas.`,
          `${timeGreeting} ${name}. Absensi berhasil, mari kita mulai kerja hari ini.`
        ]
        text = inGreetings[Math.floor(Math.random() * inGreetings.length)]
      }
    } else {
      const outGreetings = [
        `Terima kasih atas kerja kerasnya hari ini, ${name}. Hati-hati di jalan.`,
        `Absen pulang berhasil. Selamat beristirahat, ${name}.`,
        `Sampai jumpa besok, ${name}. Semoga istirahatmu menyenangkan.`,
        `Kerja bagus hari ini ${name}, silakan pulang dan beristirahat.`
      ]
      text = outGreetings[Math.floor(Math.random() * outGreetings.length)]
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'id-ID'
    utterance.rate = 0.95 // Slightly slower for natural feel
    utterance.pitch = 1.1 // Slightly higher pitch for female-like voice

    // Try to find a female Indonesian voice
    const voices = window.speechSynthesis.getVoices()
    const indonesianVoices = voices.filter(v => v.lang.includes('id') || v.lang.includes('ID'))
    
    // Attempt to pick a voice known to be female if possible (Google Bahasa Indonesia is female)
    let selectedVoice = indonesianVoices.find(v => v.name.toLowerCase().includes('female') || v.name.includes('Google') || v.name.includes('Microsoft Andika'))
    if (!selectedVoice && indonesianVoices.length > 0) {
      selectedVoice = indonesianVoices[0] // fallback to any Indonesian voice
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice
    }

    speechSynthesis.speak(utterance)
  }

  // Manual capture button
  const handleManualCapture = () => {
    if (!isCapturing) {
      captureAndRecognize()
    }
  }

  // Debug reset logs
  const handleResetLogs = async () => {
    try {
      await attendanceApi.resetLogs()
      alert('Log absensi berhasil di-reset!')
    } catch (err) {
      console.error('Reset logs error:', err)
      alert('Gagal mereset log absensi. Pastikan Anda sudah login admin di browser ini.')
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
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const shortDateStr = currentTime.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // ─── WELCOME SCREEN ─────────────────────────────────────────
  if (phase === PHASE.WELCOME) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(160deg, #070b18 0%, #0d1a33 50%, #080e1e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}>
        <style>{`
          @keyframes att-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-14px); }
          }
          @keyframes att-fadeUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes att-glow {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.15); }
          }
          @keyframes att-progressShine {
            0% { left: -40%; }
            100% { left: 140%; }
          }
          @keyframes att-orbitDots {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes att-dotPulse {
            0%, 100% { opacity: 0.4; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          @keyframes att-scanLine {
            0% { top: 0; }
            50% { top: calc(100% - 2px); }
            100% { top: 0; }
          }
          .welcome-content {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 80px;
            width: 100%;
            max-width: 1200px;
            padding: 0 40px;
            margin-top: 60px;
          }
          @media (max-width: 900px) {
            .welcome-content {
              flex-direction: column !important;
              gap: 40px !important;
              text-align: center;
              margin-top: 100px;
            }
            .welcome-right {
              align-items: center !important;
            }
          }
        `}</style>

        {/* Glowing orbs */}
        <div style={{
          position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          top: '-100px', left: '-80px',
          animation: 'att-glow 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: '350px', height: '350px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)',
          bottom: '-50px', right: '-60px',
          animation: 'att-glow 8s ease-in-out infinite', animationDelay: '2s',
        }} />

        {/* Star dots */}
        {[
          { top: '8%', left: '12%', s: 3, d: '0s' }, { top: '15%', left: '78%', s: 2, d: '1s' },
          { top: '72%', left: '15%', s: 2, d: '2s' }, { top: '82%', left: '80%', s: 3, d: '0.5s' },
          { top: '45%', left: '5%', s: 2, d: '3s' }, { top: '30%', left: '88%', s: 2, d: '1.5s' },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', top: s.top, left: s.left,
            width: `${s.s}px`, height: `${s.s}px`, borderRadius: '50%',
            background: '#6366f1', animation: 'att-glow 3s ease-in-out infinite', animationDelay: s.d,
          }} />
        ))}

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '24px 36px',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={siskaLogo} alt="SISKA" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '16px', margin: 0, lineHeight: 1.2 }}>SISKA</p>
              <p style={{ color: '#475569', fontSize: '10px', margin: 0 }}>Sistem Kehadiran AI</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#64748b',
                display: 'flex', alignItems: 'center', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#818cf8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
              title={isFullscreen ? 'Keluar fullscreen (F11)' : 'Fullscreen (F11)'}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '28px', margin: 0, fontFamily: 'monospace', letterSpacing: '2px' }}>{timeStr}</p>
              <p style={{ color: '#475569', fontSize: '11px', margin: '2px 0 0 0' }}>{shortDateStr}</p>
            </div>
          </div>
        </div>

        {/* Center content (Split Layout) */}
        <div className="welcome-content" style={{ animation: 'att-fadeUp 0.8s ease-out', zIndex: 2 }}>
          
          {/* Left: Mascot */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            
            {/* Efek Garis Orbit Belakang */}
            <div style={{
              position: 'absolute',
              width: '420px',
              height: '420px',
              border: '1px solid rgba(168, 85, 247, 0.15)',
              borderRadius: '50%',
              top: '45%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1
            }} />
            <div style={{
              position: 'absolute',
              width: '320px',
              height: '320px',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '50%',
              top: '45%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1
            }} />

            {/* Podium Cahaya Ungu di Bawah Maskot */}
            <div style={{
              position: 'absolute', 
              bottom: '-15px', 
              left: '50%', 
              transform: 'translateX(-50%)',
              width: '260px', 
              height: '30px', 
              borderRadius: '50%',
              border: '2px solid rgba(168, 85, 247, 0.8)', // Garis tepi podium
              background: 'radial-gradient(ellipse, rgba(168, 85, 247, 0.3) 0%, transparent 70%)',
              boxShadow: '0 0 40px rgba(168, 85, 247, 0.6), inset 0 0 20px rgba(168, 85, 247, 0.4)',
              zIndex: 1
            }} />

            <img src={siskaMascot} alt="SISKA Mascot" style={{
              width: '1000px', // Ukuran diperbesar dari 380px
              height: 'auto',
              filter: 'drop-shadow(0 15px 40px rgba(168, 85, 247, 0.3))', // Shadow diubah jadi ungu
              animation: 'att-float 4s ease-in-out infinite',
              position: 'relative',
              zIndex: 2,
            }} />
          </div>

          {/* Right: Info and Progress */}
          <div className="welcome-right" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}>
            <p style={{
              color: '#f8fafc', // Warna diubah jadi lebih putih
              fontSize: '26px', // Ukuran font diperbesar sedikit
              fontWeight: 500,
              margin: '0 0 8px 0',
              letterSpacing: '0.5px',
              // textTransform: 'uppercase' DIHAPUS agar sesuai desain asli
            }}>
              Selamat Datang di
            </p>
            <h1 style={{
              color: '#fff',
              fontSize: '85px',
              fontWeight: 800,
              letterSpacing: '8px',
              margin: '0 0 16px 0',
              // Gradasi diubah ke tema ungu (Purple)
              background: 'linear-gradient(135deg, #e9d5ff 0%, #c084fc 50%, #9333ea 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 35px rgba(168, 85, 247, 0.45))', // Glow ungu
              lineHeight: 1.1,
            }}>
              SISKA
            </h1>
            <p style={{
              color: '#e2e8f0', // Warna diubah agar lebih terang
              fontSize: '20px',
              fontWeight: 400,
              margin: '0 0 48px 0',
              letterSpacing: '0.5px',
              // textTransform: 'uppercase' DIHAPUS
            }}>
              Sistem Kehadiran AI
            </p>

            {/* Progress Section */}
            <div style={{ width: '100%', minWidth: '360px', maxWidth: '420px' }}>
              <p style={{
                color: '#94a3b8',
                fontSize: '15px',
                margin: '0 0 12px 0',
                letterSpacing: '0.5px',
              }}>
                Menyiapkan kamera...
              </p>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                width: '100%',
              }}>
                {/* Progress Bar Track */}
                <div style={{
                  flex: 1,
                  height: '8px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  {/* Progress Fill */}
                  <div style={{
                    height: '100%',
                    borderRadius: '4px',
                    background: 'linear-gradient(90deg, #6366f1, #818cf8, #c084fc)',
                    width: `${welcomeProgress}%`,
                    transition: 'width 0.15s ease-out',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* Shine effect */}
                    <div style={{
                      position: 'absolute', top: 0, width: '40%', height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      animation: 'att-progressShine 1.5s ease-in-out infinite',
                    }} />
                  </div>
                </div>
                
                {/* Percentage Text */}
                <span style={{
                  color: '#818cf8',
                  fontSize: '16px',
                  fontWeight: 700,
                  minWidth: '45px',
                  textAlign: 'right',
                }}>
                  {Math.round(welcomeProgress)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── MAIN ATTENDANCE SCREEN (READY) ──────────────────────────
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(160deg, #070b18 0%, #0d1a33 50%, #080e1e 100%)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @keyframes att-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        @keyframes att-fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes att-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes att-glow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        @keyframes att-orbitDots {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes att-dotPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes att-scanLine {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
        @keyframes att-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes att-spin-slow {
          to { transform: rotate(360deg); }
        }
        @keyframes att-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>

      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '700px', height: '700px', borderRadius: '50%',
          filter: 'blur(180px)',
          transition: 'all 1s',
          background: status === STATUS.RECOGNIZED
            ? 'rgba(16,185,129,0.12)'
            : status === STATUS.UNRECOGNIZED || status === STATUS.ERROR
              ? 'rgba(239,68,68,0.08)'
              : status === STATUS.SCANNING
                ? 'rgba(99,102,241,0.1)'
                : 'rgba(99,102,241,0.04)',
        }} />
      </div>

      {/* Star dots */}
      {[
        { top: '10%', left: '8%', s: 2, d: '0s' }, { top: '20%', left: '55%', s: 3, d: '1s' },
        { top: '75%', left: '12%', s: 2, d: '2s' }, { top: '85%', left: '75%', s: 2, d: '0.5s' },
        { top: '50%', left: '3%', s: 3, d: '3s' }, { top: '15%', left: '90%', s: 2, d: '1.5s' },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', top: s.top, left: s.left, zIndex: 0,
          width: `${s.s}px`, height: `${s.s}px`, borderRadius: '50%',
          background: '#6366f1', animation: 'att-glow 3s ease-in-out infinite', animationDelay: s.d,
        }} />
      ))}

      {/* ─── TOP BAR ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 32px', zIndex: 10, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={siskaLogo} alt="SISKA" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '16px', margin: 0, lineHeight: 1.2 }}>SISKA</p>
            <p style={{ color: '#475569', fontSize: '10px', margin: 0 }}>Sistem Kehadiran AI</p>
          </div>
        </div>

        {/* Time + Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Debug Reset Logs Button */}
          <button
            onClick={handleResetLogs}
            style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: '#f87171',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
              fontSize: '12px', fontWeight: 600
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
            title="Reset semua log absensi (Debug)"
          >
            <RefreshCcw size={14} />
            <span>Reset Log</span>
          </button>
          
          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#64748b',
              display: 'flex', alignItems: 'center', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#818cf8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
            title={isFullscreen ? 'Keluar fullscreen (F11)' : 'Fullscreen (F11)'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '28px', margin: 0, fontFamily: 'monospace', letterSpacing: '2px' }}>{timeStr}</p>
            <p style={{ color: '#475569', fontSize: '11px', margin: '2px 0 0 0' }}>{shortDateStr}</p>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 40px 0 40px', gap: '60px', zIndex: 5,
      }}>
        {/* ─── LEFT: Mascot with orbiting dots ─── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          animation: 'att-fadeUp 0.6s ease-out',
        }}>
          <div style={{
            position: 'relative',
            width: '320px', height: '320px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Orbit circle (dashed) */}
            <div style={{
              position: 'absolute', inset: '0',
              borderRadius: '50%',
              border: '1.5px dashed rgba(99,102,241,0.2)',
              animation: 'att-orbitDots 20s linear infinite',
            }}>
              {/* Orbiting dots */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: '#6366f1',
                  top: '50%', left: '50%',
                  transform: `rotate(${deg}deg) translateX(160px) translate(-50%, -50%)`,
                  animation: `att-dotPulse 2s ease-in-out infinite`,
                  animationDelay: `${i * 0.25}s`,
                  boxShadow: '0 0 8px rgba(99,102,241,0.5)',
                }} />
              ))}
            </div>

            {/* Mascot image (floating) */}
            <div style={{ animation: 'att-float 5s ease-in-out infinite', position: 'relative', zIndex: 2 }}>
              <div style={{
                position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)',
                width: '180px', height: '25px', borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(99,102,241,0.25) 0%, transparent 70%)',
                filter: 'blur(6px)',
              }} />
              <img src={siskaMascot} alt="SISKA" style={{
                width: '240px', height: 'auto',
                filter: 'drop-shadow(0 12px 30px rgba(99,102,241,0.2))',
              }} />
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Camera + Status ─── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          animation: 'att-fadeUp 0.8s ease-out',
        }}>
          {/* Camera viewport */}
          <div style={{
            width: '380px', height: '285px',
            borderRadius: '20px', overflow: 'hidden',
            position: 'relative',
            border: status === STATUS.RECOGNIZED
              ? '2px solid rgba(16,185,129,0.5)'
              : status === STATUS.UNRECOGNIZED || status === STATUS.ERROR
                ? '2px solid rgba(239,68,68,0.4)'
                : status === STATUS.SCANNING
                  ? '2px solid rgba(99,102,241,0.4)'
                  : '2px solid rgba(255,255,255,0.06)',
            background: '#000',
            transition: 'border-color 0.5s',
            boxShadow: status === STATUS.RECOGNIZED
              ? '0 0 40px rgba(16,185,129,0.15)'
              : status === STATUS.SCANNING
                ? '0 0 40px rgba(99,102,241,0.15)'
                : '0 8px 30px rgba(0,0,0,0.4)',
          }}>
            {/* Camera Active label */}
            <div style={{
              position: 'absolute', top: '12px', left: '12px', zIndex: 10,
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: '20px',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: cameraReady ? '#34d399' : '#fbbf24',
                animation: 'att-pulse 2s ease-in-out infinite',
              }} />
              <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 500 }}>
                {cameraReady ? 'Kamera Aktif' : 'Menghubungkan...'}
              </span>
            </div>

            {/* Camera Toggle Button */}
            <button
              onClick={() => {
                setIsCameraEnabled(!isCameraEnabled)
                if (isCameraEnabled) {
                  setCameraReady(false)
                  setStatus(STATUS.IDLE)
                }
              }}
              style={{
                position: 'absolute', top: '12px', right: '12px', zIndex: 10,
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '8px',
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: isCameraEnabled ? '#ef4444' : '#34d399',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
            >
              {isCameraEnabled ? <Camera size={14} /> : <Camera size={14} />}
              {isCameraEnabled ? 'Matikan Kamera' : 'Nyalakan Kamera'}
            </button>

            {/* Webcam */}
            {status !== STATUS.NO_CAMERA && isCameraEnabled ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.85}
                videoConstraints={{
                  width: 640,
                  height: 480,
                  facingMode: 'user',
                }}
                onUserMedia={() => setCameraReady(true)}
                onUserMediaError={() => setStatus(STATUS.NO_CAMERA)}
                mirrored
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', background: '#0a0f1c'
              }}>
                <Camera size={40} style={{ color: '#334155', marginBottom: '8px' }} />
                <p style={{ color: '#475569', fontSize: '13px' }}>
                  {!isCameraEnabled ? 'Kamera dimatikan' : 'Kamera tidak tersedia'}
                </p>
                {!isCameraEnabled && (
                  <button
                    onClick={() => setIsCameraEnabled(true)}
                    style={{
                      marginTop: '16px', padding: '8px 16px', borderRadius: '8px',
                      background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 500
                    }}
                  >
                    Nyalakan Kamera
                  </button>
                )}
              </div>
            )}

            {/* Scanning overlay */}
            {status === STATUS.SCANNING && (
              <>
                <div style={{
                  position: 'absolute', inset: 0,
                  border: '2px solid rgba(99,102,241,0.3)',
                  borderRadius: '18px', pointerEvents: 'none',
                }} />
                {/* Scan line */}
                <div style={{
                  position: 'absolute', left: '5%', right: '5%', height: '2px',
                  background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8), transparent)',
                  animation: 'att-scanLine 2s ease-in-out infinite',
                  boxShadow: '0 0 15px rgba(99,102,241,0.5)',
                  pointerEvents: 'none',
                }} />
                {/* Corner brackets */}
                <div style={{ position: 'absolute', inset: '15px', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '24px', height: '24px', borderTop: '2px solid #818cf8', borderLeft: '2px solid #818cf8', borderRadius: '4px 0 0 0' }} />
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '24px', height: '24px', borderTop: '2px solid #818cf8', borderRight: '2px solid #818cf8', borderRadius: '0 4px 0 0' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '24px', height: '24px', borderBottom: '2px solid #818cf8', borderLeft: '2px solid #818cf8', borderRadius: '0 0 0 4px' }} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '24px', height: '24px', borderBottom: '2px solid #818cf8', borderRight: '2px solid #818cf8', borderRadius: '0 0 4px 0' }} />
                </div>
              </>
            )}

            {/* Recognized overlay */}
            {status === STATUS.RECOGNIZED && result && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                padding: '20px', borderRadius: '18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {result.status === 'ok' ? (
                    <CheckCircle size={24} style={{ color: '#34d399' }} />
                  ) : (
                    <Clock size={24} style={{ color: '#fbbf24' }} />
                  )}
                  <div>
                    <p style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: 0 }}>{result.user_name}</p>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0 0' }}>
                      {result.status === 'cooldown' ? 'Cooldown (Harap Tunggu)' : 
                       result.status === 'duplicate' ? 'Sudah Lengkap' :
                       result.status !== 'ok' ? 'Ditolak' :
                       result.event_type === 'IN' ? 'Check In' : 'Check Out'} — {timeStr}
                      {result.late && ' • Terlambat'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Unrecognized overlay */}
            {status === STATUS.UNRECOGNIZED && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                padding: '20px', borderRadius: '18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <XCircle size={20} style={{ color: '#ef4444' }} />
                  <p style={{ color: '#fca5a5', fontSize: '14px', fontWeight: 600, margin: 0 }}>Wajah tidak dikenali</p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {status === STATUS.ERROR && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                padding: '20px', borderRadius: '18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <WifiOff size={20} style={{ color: '#ef4444' }} />
                  <p style={{ color: '#fca5a5', fontSize: '14px', fontWeight: 600, margin: 0 }}>Koneksi gagal</p>
                </div>
              </div>
            )}
          </div>

          {/* Status text below camera */}
          <div style={{ textAlign: 'center', marginTop: '20px', minHeight: '80px' }}>
            {/* IDLE */}
            {status === STATUS.IDLE && cameraReady && (
              <div style={{ animation: 'att-fadeIn 0.4s ease-out' }}>
                <p style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0' }}>
                  Arahkan wajah ke kamera
                </p>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
                  Deteksi otomatis setiap {CAPTURE_INTERVAL / 1000} detik
                </p>
                <button
                  onClick={handleManualCapture}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '12px 28px', borderRadius: '14px',
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    color: '#fff', fontSize: '14px', fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 25px rgba(99,102,241,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.3)'; }}
                >
                  <Scan size={16} />
                  Absen Sekarang
                </button>
              </div>
            )}

            {/* SCANNING */}
            {status === STATUS.SCANNING && (
              <div style={{ animation: 'att-fadeIn 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8',
                      animation: 'att-bounce 0.6s ease-in-out infinite',
                      animationDelay: `${i * 0.15}s`,
                    }} />
                  ))}
                </div>
                <p style={{ color: '#818cf8', fontSize: '16px', fontWeight: 600, margin: 0 }}>Memindai wajah...</p>
                <p style={{ color: '#475569', fontSize: '12px', margin: '4px 0 0 0' }}>Mohon tetap diam</p>
              </div>
            )}

            {/* RECOGNIZED */}
            {status === STATUS.RECOGNIZED && result && (
              <div style={{ animation: 'att-fadeIn 0.4s ease-out' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '10px 24px', borderRadius: '14px',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  <CheckCircle size={20} style={{ color: '#34d399' }} />
                  <span style={{ color: '#34d399', fontSize: '15px', fontWeight: 600 }}>
                    {result.event_type === 'IN' ? 'Selamat datang' : 'Sampai jumpa'}, {result.user_name}!
                  </span>
                </div>
                {result.late && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    marginTop: '8px',
                  }}>
                    <Clock size={14} style={{ color: '#fbbf24' }} />
                    <span style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 500 }}>Terlambat</span>
                  </div>
                )}
              </div>
            )}

            {/* UNRECOGNIZED */}
            {status === STATUS.UNRECOGNIZED && (
              <div style={{ animation: 'att-fadeIn 0.4s ease-out' }}>
                <p style={{ color: '#ef4444', fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0' }}>Wajah Tidak Dikenali</p>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Pastikan wajah Anda sudah terdaftar</p>
              </div>
            )}

            {/* ERROR */}
            {status === STATUS.ERROR && (
              <div style={{ animation: 'att-fadeIn 0.4s ease-out' }}>
                <p style={{ color: '#ef4444', fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0' }}>Koneksi Gagal</p>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Tidak dapat terhubung ke server</p>
              </div>
            )}

            {/* NO CAMERA */}
            {status === STATUS.NO_CAMERA && (
              <div style={{ animation: 'att-fadeIn 0.4s ease-out' }}>
                <p style={{ color: '#ef4444', fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0' }}>Kamera Tidak Terdeteksi</p>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 12px 0' }}>Pastikan kamera terhubung</p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '8px 20px', fontSize: '13px', color: '#94a3b8',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  Coba Lagi
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── BOTTOM BAR ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 32px', zIndex: 10, flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        {/* Camera status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={14} style={{ color: cameraReady ? '#34d399' : '#64748b' }} />
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: cameraReady ? '#34d399' : status === STATUS.NO_CAMERA ? '#ef4444' : '#fbbf24',
            animation: cameraReady ? 'att-pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            {cameraReady ? 'Kamera aktif' : status === STATUS.NO_CAMERA ? 'Kamera tidak tersedia' : 'Menghubungkan...'}
          </span>
        </div>

        {/* Today count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>📋</span>
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            {todayCount} absensi hari ini
          </span>
        </div>

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Wifi size={14} style={{ color: status === STATUS.ERROR ? '#ef4444' : '#34d399' }} />
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            {status === STATUS.ERROR ? 'Server terputus' : 'Server terhubung'}
          </span>
        </div>
      </div>
    </div>
  )
}
