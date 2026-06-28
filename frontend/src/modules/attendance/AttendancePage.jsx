import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Webcam from 'react-webcam'
import { Camera, Maximize, Minimize, Moon, Sun, CheckCircle, XCircle, Clock, Wifi, WifiOff, RotateCcw } from 'lucide-react'
import * as faceapi from 'face-api.js'
import attendanceApi from './services/attendanceApi'
import SiskaMascot from './SiskaMascot'
import './AttendancePage.css'

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
const RESULT_DISPLAY_MS = 10000

// Helper to get time-based greeting
const getTimeGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 10) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

// Function to join names naturally: "A, B, dan C"
const joinNames = (names) => {
  if (!names || names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} dan ${names[1]}`;
  const last = names.pop();
  return `${names.join(', ')}, dan ${last}`;
};

// Voice greeting using Web Speech API with varied sentences
async function speakCombinedGreeting(faces) {
  if (!faces || faces.length === 0) return "";
  const timeGreeting = getTimeGreeting();
  
  // Pisahkan berdasarkan status
  const successFaces = faces.filter(f => f.status === 'ok' || f.status === 'recognized');
  const cooldownFaces = faces.filter(f => f.status !== 'ok' && f.status !== 'recognized');

  let successText = "";
  if (successFaces.length > 0) {
    const inFaces = successFaces.filter(f => f.event_type === 'IN');
    const outFaces = successFaces.filter(f => f.event_type !== 'IN');

    const inNames = inFaces.map(f => f.user_name || 'Karyawan');
    const outNames = outFaces.map(f => f.user_name || 'Karyawan');

    if (inNames.length > 0) {
      const combinedInName = joinNames(inNames);
      // Cek apakah ada minimal 1 orang yang terlambat di rombongan IN
      const isLate = inFaces.some(f => f.late);
      
      if (isLate) {
        const lateGreetings = [
          `${timeGreeting} ${combinedInName}. Absen berhasil, namun ada yang tercatat terlambat hari ini.`,
          `Halo ${combinedInName}. Datang terlambat, tolong lebih tepat waktu besok ya.`,
          `Absen masuk berhasil. ${timeGreeting} ${combinedInName}, jangan terlambat lagi ya.`
        ];
        successText += lateGreetings[Math.floor(Math.random() * lateGreetings.length)] + " ";
      } else {
        const inGreetings = [
          `${timeGreeting} ${combinedInName}. Selamat bekerja dan semoga harimu menyenangkan!`,
          `Halo ${combinedInName}, absen masuk berhasil dicatat. Semangat untuk hari ini!`,
          `Selamat datang ${combinedInName}. Jangan lupa tersenyum dan selamat bertugas.`,
          `${timeGreeting} ${combinedInName}. Absensi berhasil, mari kita mulai kerja hari ini.`
        ];
        successText += inGreetings[Math.floor(Math.random() * inGreetings.length)] + " ";
      }
    }
    if (outNames.length > 0) {
      const combinedOutName = joinNames(outNames);
      const outGreetings = [
        `Terima kasih atas kerja kerasnya hari ini, ${combinedOutName}. Hati-hati di jalan.`,
        `Absen pulang berhasil. Selamat beristirahat, ${combinedOutName}.`,
        `Sampai jumpa besok, ${combinedOutName}. Semoga istirahatmu menyenangkan.`,
        `Kerja bagus hari ini ${combinedOutName}, silakan pulang dan beristirahat.`
      ];
      successText += outGreetings[Math.floor(Math.random() * outGreetings.length)] + " ";
    }
  }

  let cooldownText = "";
  if (cooldownFaces.length > 0) {
    const cooldownNames = cooldownFaces.map(f => f.user_name || 'Karyawan');
    cooldownText += `Halo ${joinNames(cooldownNames)}, mohon tunggu sebentar sebelum absen kembali.`;
  }

  const text = (successText + " " + cooldownText).trim();

  const preset = localStorage.getItem('siska_greeting_style') || 'gadis';
  let voice = 'id-ID-GadisNeural';
  let rateStr = "+0%";
  let pitchStr = "+0Hz";

  if (preset === 'bunda') {
    voice = 'id-ID-GadisNeural';
    rateStr = "-10%"; pitchStr = "-15Hz";
  } else if (preset === 'ardi') {
    voice = 'id-ID-ArdiNeural';
  } else if (preset === 'bapak') {
    voice = 'id-ID-ArdiNeural';
    rateStr = "-10%"; pitchStr = "-15Hz";
  } else if (preset === 'bima') {
    voice = 'id-ID-ArdiNeural';
    rateStr = "+10%"; pitchStr = "+15Hz";
  } else if (preset === 'yasmin') {
    voice = 'ms-MY-YasminNeural';
  } else if (preset === 'osman') {
    voice = 'ms-MY-OsmanNeural';
  }

  try {
    const response = await fetch('/api/v1/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, voice: voice, rate: rateStr, pitch: pitchStr })
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (window.currentAudio) window.currentAudio.pause();
      const audio = new Audio(url);
      window.currentAudio = audio;
      audio.play();
    }
  } catch (err) {
    console.error("Error calling TTS API:", err);
  }
  return text;
}

export default function AttendancePage() {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const timerRef = useRef(null)
  const apiBboxesRef = useRef([])
  const navigate = useNavigate()

  const [phase, setPhase] = useState(PHASE.WELCOME)
  const [status, setStatus] = useState(STATUS.IDLE)
  const [results, setResults] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cameraReady, setCameraReady] = useState(false)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isCapturing, setIsCapturing] = useState(false)
  const [hasFace, setHasFace] = useState(false)
  const hasFaceRef = useRef(false)
  const consecDetectedRef = useRef(0)
  const consecLostRef = useRef(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [greetingText, setGreetingText] = useState('')
  const [isMirrored, setIsMirrored] = useState(true)

  const [greetingStyle, setGreetingStyle] = useState(localStorage.getItem('siska_greeting_style') || 'gadis')
  const [isLightMode, setIsLightMode] = useState(() => localStorage.getItem('siska_theme') === 'light')

  // Theme observer
  useEffect(() => {
    if (isLightMode) {
      document.documentElement.setAttribute('data-theme', 'light')
      localStorage.setItem('siska_theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('siska_theme', 'dark')
    }
  }, [isLightMode])

  // Welcome progress animation dihilangkan karena user harus klik tombol secara manual

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

  // Load Face API Models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      } catch (err) {
        console.error("Error loading faceapi models:", err)
      }
    }
    loadModels()
  }, [])

  // Real-time Face Tracking
  useEffect(() => {
    let isRunning = true
    const trackFaces = async () => {
      while (isRunning) {
        if (webcamRef.current && webcamRef.current.video && cameraReady && status !== STATUS.NO_CAMERA) {
          const video = webcamRef.current.video
          if (video.readyState === 4) {
            try {
              const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
               const faceNow = detections && detections.length > 0;
               if (faceNow) {
                 consecDetectedRef.current = (consecDetectedRef.current || 0) + 1;
                 consecLostRef.current = 0;
                 if (consecDetectedRef.current >= 3 && !hasFaceRef.current) {
                   hasFaceRef.current = true;
                   setHasFace(true);
                 }
               } else {
                 consecLostRef.current = (consecLostRef.current || 0) + 1;
                 consecDetectedRef.current = 0;
                 if (consecLostRef.current >= 15 && hasFaceRef.current) {
                   hasFaceRef.current = false;
                   setHasFace(false);
                 }
               }
               const canvas = canvasRef.current
              if (canvas) {
                const displaySize = { width: video.videoWidth, height: video.videoHeight }
                faceapi.matchDimensions(canvas, displaySize)
                const resizedDetections = faceapi.resizeResults(detections, displaySize)
                
                const ctx = canvas.getContext('2d')
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                
                // Tentukan warna berdasarkan status
                let color = 'rgba(99, 102, 241, 0.8)' // default indigo
                if (status === STATUS.RECOGNIZED) color = 'rgba(16, 185, 129, 0.9)' // green
                else if (status === STATUS.ERROR || status === STATUS.UNRECOGNIZED) color = 'rgba(239, 68, 68, 0.8)' // red
                else if (status === STATUS.SCANNING) color = 'rgba(99, 102, 241, 1)' // bright indigo

                // Gambar live tracking dari face-api.js
                const apiBboxes = apiBboxesRef.current
                resizedDetections.forEach(det => {
                  let { x, y, width, height } = det.box
                  
                  // Flip jika mirrored
                  if (isMirrored) {
                    x = displaySize.width - x - width;
                  }

                  // Kotak utama
                  ctx.strokeStyle = color
                  ctx.lineWidth = 2.5
                  ctx.strokeRect(x, y, width, height)
                  
                  // Siku-siku putih
                  ctx.lineWidth = 4
                  ctx.strokeStyle = '#ffffff'
                  const l = Math.min(22, width / 4)
                  // Top Left
                  ctx.beginPath(); ctx.moveTo(x, y + l); ctx.lineTo(x, y); ctx.lineTo(x + l, y); ctx.stroke();
                  // Top Right
                  ctx.beginPath(); ctx.moveTo(x + width - l, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + l); ctx.stroke();
                  // Bottom Left
                  ctx.beginPath(); ctx.moveTo(x, y + height - l); ctx.lineTo(x, y + height); ctx.lineTo(x + l, y + height); ctx.stroke();
                  // Bottom Right
                  ctx.beginPath(); ctx.moveTo(x + width, y + height - l); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width - l, y + height); ctx.stroke();

                  // Coba pasangkan live box ini dengan nama dari API (jika status recognized)
                  let matchedName = null
                  if (apiBboxes.length > 0 && status === STATUS.RECOGNIZED) {
                    let minDist = Infinity
                    const centerX = x + width/2
                    const centerY = y + height/2
                    
                    apiBboxes.forEach(({ bbox, name }) => {
                       if(!bbox || bbox.length < 4) return
                       let [x1, y1, x2, y2] = bbox
                       if (isMirrored) {
                         const tempX1 = displaySize.width - x2
                         x2 = displaySize.width - x1
                         x1 = tempX1
                       }
                       const apiCenterX = x1 + (x2 - x1)/2
                       const apiCenterY = y1 + (y2 - y1)/2
                       
                       const dist = Math.hypot(centerX - apiCenterX, centerY - apiCenterY)
                       if (dist < 150 && dist < minDist) {
                         minDist = dist
                         matchedName = name
                       }
                    })
                    
                    // Fallback: Kalau cuman ada 1 orang di frame, paksakan nama itu ke kotak ini
                    if (!matchedName && apiBboxes.length === 1 && resizedDetections.length === 1) {
                       matchedName = apiBboxes[0].name
                    }
                  }

                  // Label nama di atas kotak live
                  if (matchedName && status === STATUS.RECOGNIZED) {
                      const label = matchedName.charAt(0).toUpperCase() + matchedName.slice(1)
                      ctx.font = 'bold 14px Inter, sans-serif'
                      const textWidth = ctx.measureText(label).width
                      const padding = 8
                      const labelH = 24
                      const labelX = x
                      const labelY = y - labelH - 4
                      
                      // Background label
                      ctx.fillStyle = color
                      ctx.beginPath()
                      ctx.roundRect(labelX, labelY, textWidth + padding * 2, labelH, 6)
                      ctx.fill()
                      
                      // Teks label
                      ctx.fillStyle = '#ffffff'
                      ctx.fillText(label, labelX + padding, labelY + 17)
                  }
                })
              }
            } catch { /* Abaikan error deteksi wajah sementara */ }
          }
        }
        await new Promise(r => setTimeout(r, 100)) // 10 fps
      }
    }
    trackFaces()
    return () => { isRunning = false }
  }, [cameraReady, status, isMirrored, isCameraEnabled])

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

      // ─── DEBUG: Log respons mentah dari API ───
      console.log('[SISKA DEBUG] Raw API Response:', JSON.stringify(data, null, 2))

      if ((data.status === 'ok' || data.status === 'recognized') && data.faces?.length > 0) {
        // Simpan bbox dari API untuk digambar di canvas
        apiBboxesRef.current = data.faces
          .filter(f => f.bbox)
          .map(f => ({ bbox: f.bbox, name: f.user_name || f.name }))

        // Ambil maksimal 5 wajah teratas yang valid
        const validFaces = data.faces
          .map(f => {
            f.user_name = f.user_name || f.name;
            return f;
          })
          .filter(f => f.user_name && f.user_name !== "Unknown")
          .slice(0, 5);
          
        if (validFaces.length > 0) {
          setResults(validFaces)
          setStatus(STATUS.RECOGNIZED)
          speakCombinedGreeting(validFaces).then(text => setGreetingText(text))
        } else {
          setResults([])
          setStatus(STATUS.UNRECOGNIZED)
        }
      } else {
        setResults([])
        setStatus(STATUS.UNRECOGNIZED)
      }
    } catch (err) {
      console.error('Recognition error:', err)
      setResults([])
      setStatus(STATUS.ERROR)
    }

    // Auto-reset after showing result
    setTimeout(() => {
      setStatus(STATUS.IDLE)
      setResults([])
      setIsCapturing(false)
      setGreetingText('')
      apiBboxesRef.current = [] // Bersihkan bbox setelah reset
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

  // Format time
  const timeStr = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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
        background: isLightMode ? '#f8fafc' : '#020617',
        display: 'flex',
        flexDirection: 'column',  
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}>
        {/* === HEADER BAR === */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 30,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 60px', // Ketebalan vertikal dikurangi dari 24px ke 12px
          background: isLightMode ? 'rgba(255,255,255,0.95)' : 'rgba(15, 23, 42, 0.95)',
          borderBottom: isLightMode ? '1px solid rgba(14, 165, 233, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)', // Garis header dimunculkan kembali
          backdropFilter: 'blur(10px)'
        }}>
          
          {/* Header Left: Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              filter: isLightMode ? 'drop-shadow(0 2px 5px rgba(14,165,233,0.3))' : 'drop-shadow(0 0 10px rgba(0,242,254,0.4))' 
            }}>
              <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 65 15 L 35 15 A 15 15 0 0 0 20 30 A 15 15 0 0 0 35 45 L 65 45" stroke="url(#logoGrad1)" strokeWidth="14" strokeLinecap="round" />
                <path d="M 35 85 L 65 85 A 15 15 0 0 0 80 70 A 15 15 0 0 0 65 55 L 35 55" stroke="url(#logoGrad2)" strokeWidth="14" strokeLinecap="round" />
                <circle cx="85" cy="15" r="7" fill="#00f2fe" />
                <circle cx="15" cy="85" r="7" fill="#00f2fe" />
                <defs>
                  <linearGradient id="logoGrad1" x1="20" y1="15" x2="65" y2="45" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#00f2fe" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="logoGrad2" x1="35" y1="85" x2="80" y2="55" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#00f2fe" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '24px', fontWeight: 800, letterSpacing: '2px',
              color: isLightMode ? '#0f172a' : '#ffffff',
            }}>
              SISKA
            </span>
          </div>

          {/* Header Right: Controls */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              style={{
                background: 'transparent', border: 'none', 
                color: isLightMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)', 
                cursor: 'pointer', padding: '8px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.color = isLightMode ? '#0f172a' : '#f8fafc';
                e.currentTarget.style.background = isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.color = isLightMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)';
                e.currentTarget.style.background = 'transparent';
              }}
              title={isLightMode ? 'Ganti ke Mode Gelap' : 'Ganti ke Mode Terang'}
            >
              {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Fullscreen/Kiosk Toggle */}
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'transparent', border: 'none', 
                color: isLightMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)', 
                cursor: 'pointer', padding: '8px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.color = isLightMode ? '#0f172a' : '#f8fafc';
                e.currentTarget.style.background = isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.color = isLightMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)';
                e.currentTarget.style.background = 'transparent';
              }}
              title={isFullscreen ? 'Keluar Fullscreen' : 'Fullscreen Kiosk Mode'}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>

        {/* Decorative Background & Glows */}
        <>
          {/* Thin Grid Pattern (Dark Mode Only) */}
          {!isLightMode && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `
                linear-gradient(rgba(56, 189, 248, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(56, 189, 248, 0.03) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px', zIndex: 0
            }} />
          )}

          {/* Top Left Glow (Muncul di Terang & Gelap) */}
          <div style={{
            position: 'absolute', top: '-10%', left: '-5%', width: '400px', height: '400px',
            background: isLightMode 
              ? 'radial-gradient(circle, rgba(85, 128, 247, 0.6) 0%, transparent 70%)' 
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)',
            filter: 'blur(50px)', zIndex: 0
          }} /> 
          
          {/* Bottom Right Glow (Muncul di Terang & Gelap) */}
          <div style={{
            position: 'absolute', bottom: '-15%', right: '-10%', width: '600px', height: '600px',
            background: isLightMode
              ? 'radial-gradient(circle, rgba(85, 128, 247, 0.6) 0%, transparent 70%)' /* Diubah agar jauh lebih terang/jelas */
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)',
            filter: 'blur(60px)', zIndex: 0
          }} />

          {/* Center Subtle Glow (Hanya Dark Mode atau sangat tipis di Light Mode) */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '500px', height: '500px',
            background: isLightMode
              ? 'radial-gradient(circle, rgba(56, 189, 248, 0.02) 0%, transparent 60%)'
              : 'radial-gradient(circle, rgba(56, 189, 248, 0.04) 0%, transparent 60%)',
            filter: 'blur(40px)', zIndex: 0
          }} />
        </>

        {/* Main Content (Split Layout) */}
        <div style={{ 
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'row',
          alignItems: 'center', justifyContent: 'space-between',
          width: '100%', maxWidth: '1500px', margin: '0 auto', 
          padding: '180px 80px 40px 80px', // Padding atas diperbesar ke 180px agar tidak nabrak header
          minHeight: '100vh', height: 'auto', 
          animation: 'att-fadeUp 0.8s ease-out'
        }}>
          
          {/* === LEFT SIDE (Logo, Text, Buttons) === */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-start', textAlign: 'left',
            flex: '1 1 50%', maxWidth: '600px'
          }}>
            
            {/* Area kosong di mana logo S dulunya berada */}
            {/* Typography */}
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '14px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase',
              color: isLightMode ? '#0ea5e9' : '#38bdf8', marginBottom: '16px', display: 'block'
            }}>
              PRESENSI AKADEMIK DIGITAL
            </span>

            <h1 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '72px', fontWeight: 800, letterSpacing: '-1px', // Modern Sans-Serif Look
              margin: '0 0 32px 0', 
              color: isLightMode ? '#4874dbff' : '#ffffff',
              lineHeight: 1.15
            }}>
              Sistem Kehadiran AI
            </h1>

            <p style={{
              color: isLightMode ? '#1e293b' : '#f8fafc',
              fontSize: '24px', fontWeight: 500, margin: '0 0 24px 0', 
              maxWidth: '600px', lineHeight: 1.4 
            }}>
              Solusi presensi cerdas terintegrasi untuk mendukung efisiensi kegiatan belajar mengajar.
            </p>

            <p style={{
              fontFamily: "'Inter', sans-serif",
              color: isLightMode ? '#64748b' : '#94a3b8',
              fontSize: '18px', fontWeight: 400, margin: '0 0 60px 0',
              maxWidth: '550px', lineHeight: 1.7 
            }}>
              Hadirkan pengalaman pencatatan kehadiran yang lebih cepat, akurat, dan aman bagi tenaga pendidik melalui teknologi pengenalan wajah mutakhir.
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '20px', fontFamily: "'Poppins', sans-serif" }}>
              <button
                onClick={() => setPhase(PHASE.READY)}
                style={{
                  padding: '0 36px', height: '56px', borderRadius: '50px', // Pill Shape
                  background: isLightMode ? '#0ea5e9' : '#ffffff',
                  color: isLightMode ? '#ffffff' : '#0f172a',
                  fontSize: '16px', fontWeight: 600, border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: isLightMode ? '0 10px 25px rgba(14, 165, 233, 0.3)' : '0 10px 25px rgba(255, 255, 255, 0.2)', 
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isLightMode ? '0 15px 35px rgba(14, 165, 233, 0.4)' : '0 15px 35px rgba(255, 255, 255, 0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isLightMode ? '0 10px 25px rgba(14, 165, 233, 0.3)' : '0 10px 25px rgba(255, 255, 255, 0.2)'; }}
              >
                Mulai Presensi
              </button>
              
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '0 36px', height: '56px', borderRadius: '50px', // Pill Shape
                  background: 'transparent',
                  color: isLightMode ? '#64748b' : '#f8fafc', 
                  fontSize: '16px', fontWeight: 600,
                  border: isLightMode ? '2px solid #cbd5e1' : '2px solid rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = isLightMode ? '#94a3b8' : 'rgba(255, 255, 255, 0.6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.3)'; }}
              >
                Login Admin
              </button>
            </div>

            <div style={{ marginTop: '120px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
              <span style={{ fontSize: '12px', color: isLightMode ? '#64748b' : '#64748b', fontWeight: 500 }}>Sistem Online</span>
            </div>

          </div>

          {/* === RIGHT SIDE (Mascot Animation) === */}
          <div style={{
            flex: '1 1 50%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
          }}>
            <div style={{
              width: '100%', maxWidth: '500px', height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center',
              animation: 'att-float 4s infinite ease-in-out', // Animasi melayang
              filter: isLightMode ? 'drop-shadow(0 30px 40px rgba(14, 165, 233, 0.2))' : 'drop-shadow(0 30px 40px rgba(56, 189, 248, 0.3))'
            }}>
              <SiskaMascot status="idle" />
            </div>
          </div>

        </div>
      </div>
    )
  }

  // ─── MAIN ATTENDANCE SCREEN (READY) ──────────────────────────
  return (
    <div className="att-container">
      {/* Ambient background glow */}
      <div className="att-ambient-wrapper">
        <div className="att-ambient-glow" style={{
          transition: 'all 1s',
          background: status === STATUS.RECOGNIZED
            ? 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 60%)'
            : status === STATUS.UNRECOGNIZED || status === STATUS.ERROR
              ? 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)'
              : status === STATUS.SCANNING
                ? 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 60%)'
                : 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 60%)',
        }} />
      </div>

      {/* ─── DYNAMIC BACKGROUND BLOBS ─── */}
      <div className="att-bg-blobs">
        <div className="att-blob att-blob-1"></div>
        <div className="att-blob att-blob-2"></div>
        <div className="att-blob att-blob-3"></div>
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
          background: 'var(--color-primary)', animation: 'att-glow 3s ease-in-out infinite', animationDelay: s.d,
        }} />
      ))}

      {/* ─── ABSOLUTE BUTTONS & STATUS ─── */}
      <div style={{ position: 'absolute', top: '35px', left: '40px', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wifi size={16} style={{ color: status === STATUS.ERROR ? '#ef4444' : '#10b981' }} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>
            {status === STATUS.ERROR ? 'Server terputus' : 'Server terhubung'}
          </span>
        </div>
      </div>

      <div style={{ position: 'absolute', top: '35px', right: '40px', zIndex: 20 }}>
        <button
          onClick={toggleFullscreen}
          style={{
            background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title={isFullscreen ? 'Keluar Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>

      {/* ─── TOP BAR ─── */}
      <div className="att-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          
          <p style={{ 
            color: 'var(--color-text-secondary)', 
            fontSize: '16px', 
            fontWeight: 500,
            margin: 0
          }}>{shortDateStr}</p>

          <button
            onClick={() => setIsLightMode(!isLightMode)}
            className="att-btn-fullscreen"
            title={isLightMode ? 'Mode Gelap' : 'Mode Terang'}
          >
            {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div style={{ height: '20px', width: '2px', background: 'var(--color-border)', borderRadius: '2px' }} />

          <p style={{ 
            color: 'var(--color-text)', 
            fontWeight: 700, 
            fontSize: '26px', 
            margin: 0, 
            letterSpacing: '1px' 
          }}>{timeStr}</p>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="att-main-content">
        {/* ─── LEFT: Mascot with orbiting dots ─── */}
        <div className="att-left-side">
          <div className="att-mascot-wrapper">
            {/* Orbit circle (dashed) */}
            <div className="att-orbit-circle">
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
            <div className="att-mascot-image-wrapper">
              <div className="att-mascot-shadow" />
              <SiskaMascot
                faceDetected={(hasFace && isCameraEnabled) || isCapturing || status === STATUS.SCANNING || status === STATUS.RECOGNIZED}
                attendanceResult={status}
              />
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Camera + Status ─── */}
        <div className="att-right-side">
          {/* Camera Card Container */}
          <div className="att-camera-card">
            
            {/* Card Header (Voice Selector) */}
            <div className="att-camera-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px' }}>🎙️</span>
                <select
                  value={greetingStyle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGreetingStyle(val);
                    localStorage.setItem('siska_greeting_style', val);

                    let voice = 'id-ID-GadisNeural';
                    let r = "+0%", p = "+0Hz";

                    if (val === 'bunda') { voice = 'id-ID-GadisNeural'; r = "-10%"; p = "-15Hz"; }
                    else if (val === 'ardi') { voice = 'id-ID-ArdiNeural'; }
                    else if (val === 'bapak') { voice = 'id-ID-ArdiNeural'; r = "-10%"; p = "-15Hz"; }
                    else if (val === 'bima') { voice = 'id-ID-ArdiNeural'; r = "+10%"; p = "+15Hz"; }
                    else if (val === 'yasmin') { voice = 'ms-MY-YasminNeural'; }
                    else if (val === 'osman') { voice = 'ms-MY-OsmanNeural'; }

                    let testText = "Halo, suara saya telah berhasil diganti. Apakah sudah terdengar pas?";

                    fetch('/api/v1/tts/synthesize', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: testText, voice: voice, rate: r, pitch: p })
                    }).then(res => res.blob()).then(blob => {
                      const url = URL.createObjectURL(blob);
                      if (window.currentAudio) window.currentAudio.pause();
                      const audio = new Audio(url);
                      window.currentAudio = audio;
                      audio.play();
                    });
                  }}
                  style={{
                    background: 'transparent',
                    color: 'var(--color-primary)',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                    textAlign: 'left'
                  }}
                  title="Pilih Karakter Suara"
                >
                  <option value="gadis">Gadis (Wanita Muda)</option>
                  <option value="bunda">Bunda (Wanita Dewasa)</option>
                  <option value="ardi">Ardi (Pria Muda)</option>
                  <option value="bapak">Bapak (Pria Dewasa)</option>
                  <option value="bima">Bima (Remaja Pria)</option>
                  <option value="yasmin">Yasmin (Melayu)</option>
                  <option value="osman">Osman (Melayu)</option>
                </select>
              </div>
              
              <div className={`att-status-dot ${cameraReady ? 'active' : 'inactive'}`} title={cameraReady ? 'Kamera Sedang Aktif' : 'Kamera Mati'} />
            </div>

            {/* Camera viewport */}
            <div className="att-camera-card-viewport" style={{
              border: status === STATUS.RECOGNIZED
                ? '2px solid var(--color-success)'
                : status === STATUS.UNRECOGNIZED || status === STATUS.ERROR
                  ? '2px solid var(--color-error)'
                  : status === STATUS.SCANNING
                    ? '2px solid var(--color-primary)'
                    : '2px solid transparent',
              transition: 'border-color 0.5s',
            }}>
            {/* Webcam */}
            {status !== STATUS.NO_CAMERA ? (
              <>
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
                  mirrored={isMirrored}
                  style={{ 
                    width: '100%', height: '100%', objectFit: 'cover',
                    filter: !isCameraEnabled ? 'blur(16px)' : 'none',
                    transition: 'filter 0.4s ease-out'
                  }}
                />
                
                {/* ─── REALTIME FACE TRACKING CANVAS ─── */}
                {isCameraEnabled && (
                  <canvas
                    ref={canvasRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      zIndex: 15
                    }}
                  />
                )}

                {/* OVERLAY KAMERA DIMATIKAN */}
                {!isCameraEnabled && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', 
                    background: 'rgba(0, 0, 0, 0.3)', zIndex: 20
                  }}>
                    <Camera size={40} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                    <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500, letterSpacing: '0.5px' }}>
                      Kamera dijeda
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', 
                background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(10px)'
              }}>
                <Camera size={40} style={{ color: 'var(--color-text-secondary)', marginBottom: '8px' }} />
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  Kamera tidak tersedia
                </p>
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
            {status === STATUS.RECOGNIZED && results.length > 0 && (
              <div className="att-overlay att-overlay-recognized">
                {results.map((res, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {res.status === 'ok' ? (
                      <CheckCircle size={20} style={{ color: '#34d399' }} />
                    ) : (
                      <Clock size={20} style={{ color: '#fbbf24' }} />
                    )}
                    <div>
                      <p style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0 }}>{res.user_name}</p>
                      <p style={{ color: '#94a3b8', fontSize: '11px', margin: '2px 0 0 0' }}>
                        {res.status === 'cooldown' ? 'Cooldown' : 
                         res.status === 'duplicate' ? 'Sudah Lengkap' :
                         res.status !== 'ok' ? 'Ditolak' :
                         res.event_type === 'IN' ? 'Check In' : 'Check Out'} — {timeStr}
                        {res.late && ' • Terlambat'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unrecognized overlay */}
            {status === STATUS.UNRECOGNIZED && (
              <div className="att-overlay att-overlay-unrecognized">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <XCircle size={20} style={{ color: '#ef4444' }} />
                  <p style={{ color: '#fca5a5', fontSize: '14px', fontWeight: 600, margin: 0 }}>Wajah tidak dikenali</p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {status === STATUS.ERROR && (
              <div className="att-overlay att-overlay-unrecognized">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <WifiOff size={20} style={{ color: '#ef4444' }} />
                  <p style={{ color: '#fca5a5', fontSize: '14px', fontWeight: 600, margin: 0 }}>Koneksi gagal</p>
                </div>
              </div>
            )}
          </div>

          {/* Camera Card Footer (Toggle + Text + Mirror) */}
          <div className="att-camera-card-footer">
            <button
              className={`att-toggle-switch ${isCameraEnabled ? 'active' : ''}`}
              onClick={() => {
                const nextState = !isCameraEnabled;
                setIsCameraEnabled(nextState);
                if (!nextState) {
                  setCameraReady(false);
                  setStatus(STATUS.IDLE);
                  setHasFace(false);
                  hasFaceRef.current = false;
                  consecDetectedRef.current = 0;
                  consecLostRef.current = 0;
                } else {
                  if (webcamRef.current && webcamRef.current.video) {
                    setCameraReady(true);
                  } else {
                    setTimeout(() => setCameraReady(true), 500);
                  }
                }
              }}
              title={isCameraEnabled ? 'Matikan Kamera' : 'Hidupkan Kamera'}
            />

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {status === STATUS.IDLE && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                  Menunggu wajah terdeteksi...
                </span>
              )}
              {status === STATUS.SCANNING && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)', animation: 'att-bounce 0.6s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Memindai wajah...</span>
                </div>
              )}
              {status === STATUS.UNRECOGNIZED && (
                <span style={{ color: 'var(--color-error)', fontSize: '13px', fontWeight: 600 }}>Wajah Tidak Dikenali</span>
              )}
              {status === STATUS.ERROR && (
                <span style={{ color: 'var(--color-error)', fontSize: '13px', fontWeight: 600 }}>Koneksi Gagal</span>
              )}
              {status === STATUS.NO_CAMERA && (
                <span style={{ color: 'var(--color-error)', fontSize: '13px', fontWeight: 600 }}>Kamera Tidak Terdeteksi</span>
              )}
            </div>

            <button
              className="att-mirror-btn"
              onClick={() => setIsMirrored(!isMirrored)}
              title={isMirrored ? 'Matikan Cermin' : 'Hidupkan Cermin'}
            >
              <RotateCcw size={22} />
            </button>
          </div>
        </div>

        {/* Sapaan Card below camera */}
        <div className="att-greeting-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100px', padding: '16px' }}>
            <div className="att-greeting-content" style={{ width: '100%', textAlign: 'center' }}>
              {/* IDLE / DEFAULT WELCOME */}
              {status !== STATUS.RECOGNIZED && (
                <div style={{ animation: 'att-fadeIn 0.4s ease-out', color: 'var(--color-text)', fontSize: '16px', fontWeight: 500 }}>
                  Selamat datang di SISKA! Silakan posisikan wajah Anda di depan kamera.
                </div>
              )}

              {/* RECOGNIZED */}
              {status === STATUS.RECOGNIZED && results.length > 0 && (
                <div style={{ animation: 'att-fadeIn 0.4s ease-out', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
                    {results.map((res, idx) => (
                      <div key={idx} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '6px 14px', borderRadius: '20px',
                        background: res.status === 'ok' || res.status === 'recognized' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        border: res.status === 'ok' || res.status === 'recognized' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                      }}>
                        {res.status === 'ok' || res.status === 'recognized' ? (
                          <CheckCircle size={16} style={{ color: '#34d399' }} />
                        ) : (
                          <Clock size={16} style={{ color: '#fbbf24' }} />
                        )}
                        <span style={{ color: res.status === 'ok' || res.status === 'recognized' ? '#34d399' : '#fbbf24', fontSize: '14px', fontWeight: 700 }}>
                          {res.user_name}
                          {res.late && ' (Telat)'}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {greetingText && (
                    <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', lineHeight: '1.4' }}>
                      "{greetingText}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM BAR ─── */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        paddingTop: '16px', paddingBottom: '16px',
        zIndex: 10, flexShrink: 0,
      }}>
        {/* SISKA Branding Engine */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>✨</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 500, letterSpacing: '0.5px' }}>
            Powered by SISKA AI Engine
          </span>
        </div>
      </div>
    </div>
  )
}
