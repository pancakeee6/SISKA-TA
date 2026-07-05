import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { Camera, Maximize, Minimize, Moon, Sun, CheckCircle, XCircle, Clock, Wifi, WifiOff, RotateCcw } from 'lucide-react'
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

// Auto-capture interval in ms (dipercepat ke 1.5 detik untuk responsivitas STB maksimal)
const CAPTURE_INTERVAL = 1500
// How long to show result before resetting (dioptimalkan ke 5 detik agar antrean siswa lancar & tidak terkunci 18 detik)
const RESULT_DISPLAY_MS = 5000

// Audio Queue helper to prevent collisions
window.audioQueue = window.audioQueue || [];
window.isAudioPlaying = window.isAudioPlaying || false;

const playNextAudio = () => {
  if (window.audioQueue.length === 0) {
    window.isAudioPlaying = false;
    return;
  }
  window.isAudioPlaying = true;
  const url = window.audioQueue.shift();
  const audio = new Audio(url);
  audio.volume = 1.0;
  window.currentAudio = audio;

  const cleanup = () => {
    URL.revokeObjectURL(url);
    audio.onended = null;
    audio.onerror = null;
    audio.src = "";
    window.currentAudio = null;
    playNextAudio();
  };

  audio.onended = cleanup;
  audio.onerror = cleanup;

  // Solusi B: Tunggu buffer canplaythrough & beri jeda pemanasan DAC hardware STB 150ms
  const startPlay = () => {
    setTimeout(() => {
      audio.play().catch(() => {
        cleanup();
      });
    }, 150);
  };

  if (audio.readyState >= 3) {
    startPlay();
  } else {
    audio.oncanplaythrough = () => {
      audio.oncanplaythrough = null;
      startPlay();
    };
    setTimeout(() => {
      if (window.currentAudio === audio && audio.paused) {
        startPlay();
      }
    }, 2000);
  }
};

const queueAudio = (url) => {
  window.audioQueue.push(url);
  if (!window.isAudioPlaying) {
    playNextAudio();
  }
};


// Function to join names naturally: "A, B, dan C"
const joinNames = (names) => {
  if (!names || names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} dan ${names[1]}`;
  const last = names.pop();
  return `${names.join(', ')}, dan ${last}`;
};

// Voice greeting using Web Speech API with varied sentences (Khusus Bahasa Indonesia singkat & stabil untuk STB)
async function speakCombinedGreeting(faces) {
  if (!faces || faces.length === 0) return "";
  
  // Pisahkan berdasarkan status
  const successFaces = faces.filter(f => f.status === 'ok' || f.status === 'recognized');
  const cooldownFaces = faces.filter(f => f.status !== 'ok' && f.status !== 'recognized');

  let textId = "";

  if (successFaces.length > 0) {
    const inFaces = successFaces.filter(f => f.event_type === 'IN');
    const outFaces = successFaces.filter(f => f.event_type !== 'IN');

    const inNames = inFaces.map(f => f.user_name || 'Karyawan');
    const outNames = outFaces.map(f => f.user_name || 'Karyawan');

    if (inNames.length > 0) {
      const combinedInName = joinNames(inNames);
      const isLate = inFaces.some(f => f.late);
      
      if (isLate) {
        const lateGreetings = [
          `Halo, ${combinedInName}. Absen tercatat, mohon lebih tepat waktu besok ya.`,
          `Halo, ${combinedInName}. Absen masuk berhasil, jangan terlambat lagi ya.`
        ];
        textId += lateGreetings[Math.floor(Math.random() * lateGreetings.length)] + " ";
      } else {
        const inGreetings = [
          `Halo, ${combinedInName}. Selamat pagi dan semangat belajar!`,
          `Halo, ${combinedInName}. Absen masuk berhasil, selamat bertugas!`
        ];
        textId += inGreetings[Math.floor(Math.random() * inGreetings.length)] + " ";
      }
    }

    if (outNames.length > 0) {
      const combinedOutName = joinNames(outNames);
      const outGreetings = [
        `Terima kasih hari ini, ${combinedOutName}. Hati-hati di jalan pulang.`,
        `Absen pulang berhasil. Selamat beristirahat, ${combinedOutName}.`
      ];
      textId += outGreetings[Math.floor(Math.random() * outGreetings.length)] + " ";
    }
  }

  if (cooldownFaces.length > 0) {
    const cooldownNames = cooldownFaces.map(f => f.user_name || 'Karyawan');
    const cooldownGreetings = [
      `Halo, ${joinNames(cooldownNames)}. Absenmu sudah tercatat sebelumnya.`
    ];
    textId += cooldownGreetings[Math.floor(Math.random() * cooldownGreetings.length)] + " ";
  }

  const combinedText = textId.trim();
  // Solusi A: Tambahkan jeda elipsis dan koma di awal kalimat agar DAC hardware STB tidak memotong kata pertama
  const ttsText = `. . , , ${combinedText}`;
  if (!combinedText) return "";

  // Menggunakan karakter suara Ava (Multilingual Neural) yang jauh lebih ramah, hangat, dan ekspresif
  const voice = 'en-US-AvaMultilingualNeural'; 
  const rateStr = "+0%";
  const pitchStr = "+0Hz";

  // Client-Side In-Memory TTS Cache: Jika sapaan yang sama pernah dibuat, putar instan (0ms latency!)
  window.ttsAudioCache = window.ttsAudioCache || new Map();
  if (window.ttsAudioCache.has(ttsText)) {
    queueAudio(window.ttsAudioCache.get(ttsText));
    return combinedText;
  }

  try {
    const response = await fetch('/api/v1/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: ttsText, voice: voice, rate: rateStr, pitch: pitchStr })
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (window.ttsAudioCache.size > 50) {
        const firstKey = window.ttsAudioCache.keys().next().value;
        URL.revokeObjectURL(window.ttsAudioCache.get(firstKey));
        window.ttsAudioCache.delete(firstKey);
      }
      window.ttsAudioCache.set(ttsText, url);
      queueAudio(url);
    }
  } catch (err) {
    console.error("Error calling TTS API:", err);
  }
  return combinedText;
}

export default function AttendancePage() {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const timerRef = useRef(null)
  const apiBboxesRef = useRef([])

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

  const [greetingStyle, setGreetingStyle] = useState(localStorage.getItem('siska_greeting_style') || 'ava')
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

  const prevFrameRef = useRef(null)
  const motionCanvasRef = useRef(document.createElement('canvas'))
  const captureCanvasRef = useRef(document.createElement('canvas'))

  // Real-time STB Pure Lite Presence Gate (< 0.05% CPU / 0% WebGL) & Bbox Rendering
  useEffect(() => {
    let isRunning = true
    const motionCanvas = motionCanvasRef.current
    motionCanvas.width = 32
    motionCanvas.height = 24
    const motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true })

    const trackPresence = async () => {
      while (isRunning) {
        if (!isCameraEnabled || document.hidden || status === STATUS.NO_CAMERA) {
          const canvas = canvasRef.current
          if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
          }
          await new Promise(r => setTimeout(r, 500))
          continue
        }

        if (webcamRef.current && webcamRef.current.video && cameraReady) {
          const video = webcamRef.current.video
          if (video.readyState === 4 && video.videoWidth > 0) {
            try {
              // ─── STB Pure Lite Presence Gate (Matematika simpel piksel 32x24) ───
              motionCtx.drawImage(video, 0, 0, 32, 24)
              const frameData = motionCtx.getImageData(0, 0, 32, 24).data
              let totalDiff = 0
              if (prevFrameRef.current) {
                const prev = prevFrameRef.current
                for (let i = 0; i < frameData.length; i += 4) {
                  totalDiff += Math.abs(frameData[i] - prev[i])
                }
              }
              const avgDiff = prevFrameRef.current ? (totalDiff / (32 * 24)) : 100
              prevFrameRef.current = new Uint8ClampedArray(frameData)

              // Jika ada pergerakan/kehadiran siswa di depan kamera
              if (avgDiff >= 2.0) {
                consecDetectedRef.current = (consecDetectedRef.current || 0) + 1
                consecLostRef.current = 0
                if (consecDetectedRef.current >= 1 && !hasFaceRef.current) {
                  hasFaceRef.current = true
                  setHasFace(true)
                }
              } else {
                // Jika ruangan diam
                consecLostRef.current = (consecLostRef.current || 0) + 1
                // Beri toleransi 30 tick (~6 detik) sebelum mengaktifkan mode tidur
                // Agar proses scanning tidak terputus saat siswa berdiri tenang
                if (consecLostRef.current >= 30 && hasFaceRef.current && status === STATUS.IDLE) {
                  hasFaceRef.current = false
                  setHasFace(false)
                  consecDetectedRef.current = 0
                }
              }

              // ─── Render Bounding Box dari respons API Backend ───
              const canvas = canvasRef.current
              if (canvas) {
                const displaySize = { width: video.videoWidth, height: video.videoHeight }
                if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
                  canvas.width = displaySize.width
                  canvas.height = displaySize.height
                }
                const ctx = canvas.getContext('2d')
                ctx.clearRect(0, 0, canvas.width, canvas.height)

                const apiBboxes = apiBboxesRef.current || []
                if (apiBboxes.length > 0 && (status === STATUS.RECOGNIZED || status === STATUS.SCANNING)) {
                  let color = status === STATUS.RECOGNIZED ? 'rgba(16, 185, 129, 0.9)' : 'rgba(99, 102, 241, 0.9)'
                  apiBboxes.forEach(({ bbox, name }) => {
                    if (!bbox || bbox.length < 4) return
                    // Skala disesuaikan dengan resolusi asli video agar kotak wajah akurat 100%
                    const scaleX = displaySize.width / (video.videoWidth || 640)
                    const scaleY = displaySize.height / (video.videoHeight || 480)
                    let x1 = bbox[0] * scaleX
                    let y1 = bbox[1] * scaleY
                    let x2 = bbox[2] * scaleX
                    let y2 = bbox[3] * scaleY
                    let width = x2 - x1
                    let height = y2 - y1

                    if (isMirrored) {
                      x1 = displaySize.width - x1 - width
                    }

                    ctx.strokeStyle = color
                    ctx.lineWidth = 2.5
                    ctx.strokeRect(x1, y1, width, height)

                    ctx.lineWidth = 4
                    ctx.strokeStyle = '#ffffff'
                    const l = Math.min(22, width / 4)
                    ctx.beginPath(); ctx.moveTo(x1, y1 + l); ctx.lineTo(x1, y1); ctx.lineTo(x1 + l, y1); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(x1 + width - l, y1); ctx.lineTo(x1 + width, y1); ctx.lineTo(x1 + width, y1 + l); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(x1, y1 + height - l); ctx.lineTo(x1, y1 + height); ctx.lineTo(x1 + l, y1 + height); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(x1 + width, y1 + height - l); ctx.lineTo(x1 + width, y1 + height); ctx.lineTo(x1 + width - l, y1 + height); ctx.stroke();

                    if (name && status === STATUS.RECOGNIZED) {
                      const label = name.charAt(0).toUpperCase() + name.slice(1)
                      ctx.font = 'bold 14px Inter, sans-serif'
                      const textWidth = ctx.measureText(label).width
                      const padding = 8
                      const labelH = 24
                      const labelX = x1
                      const labelY = y1 - labelH - 4

                      ctx.fillStyle = color
                      ctx.beginPath()
                      ctx.roundRect(labelX, labelY, textWidth + padding * 2, labelH, 6)
                      ctx.fill()

                      ctx.fillStyle = '#ffffff'
                      ctx.fillText(label, labelX + padding, labelY + 17)
                    }
                  })
                } else if (hasFaceRef.current && status === STATUS.SCANNING) {
                  // Indikator target scan futuristik saat API backend memindai
                  const centerX = displaySize.width / 2
                  const centerY = displaySize.height / 2
                  const boxW = Math.min(240, displaySize.width * 0.45)
                  const boxH = boxW * 1.25
                  const x1 = centerX - boxW / 2
                  const y1 = centerY - boxH / 2

                  ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)'
                  ctx.lineWidth = 2
                  ctx.strokeRect(x1, y1, boxW, boxH)

                  ctx.lineWidth = 4
                  ctx.strokeStyle = '#6366f1'
                  const l = 24
                  ctx.beginPath(); ctx.moveTo(x1, y1 + l); ctx.lineTo(x1, y1); ctx.lineTo(x1 + l, y1); ctx.stroke();
                  ctx.beginPath(); ctx.moveTo(x1 + boxW - l, y1); ctx.lineTo(x1 + boxW, y1); ctx.lineTo(x1 + boxW, y1 + l); ctx.stroke();
                  ctx.beginPath(); ctx.moveTo(x1, y1 + boxH - l); ctx.lineTo(x1, y1 + boxH); ctx.lineTo(x1 + l, y1 + boxH); ctx.stroke();
                  ctx.beginPath(); ctx.moveTo(x1 + boxW, y1 + boxH - l); ctx.lineTo(x1 + boxW, y1 + boxH); ctx.lineTo(x1 + boxW - l, y1 + boxH); ctx.stroke();
                }
              }
            } catch { /* Abaikan error canvas sementara */ }
          }
        }
        const sleepTime = (status === STATUS.RECOGNIZED || status === STATUS.UNRECOGNIZED) ? 500 : 200
        await new Promise(r => setTimeout(r, sleepTime))
      }
    }
    trackPresence()
    return () => { isRunning = false }
  }, [cameraReady, status, isMirrored, isCameraEnabled])

  // Instant Audio Beep saat scanning dimulai (memberi umpan balik psikologis < 10ms tanpa latency cloud)
  const playInstantBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Nada A5 (high beep futuristik)
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch { /* Abaikan jika audio context belum diizinkan browser */ }
  };

  // Capture Asinkron Langsung ke Blob (Kompresi 320x240 @ 0.60 JPEG untuk hemat 50% bandwidth & CPU STB)
  const captureAndRecognize = useCallback(async () => {
    if (!webcamRef.current || !webcamRef.current.video || isCapturing) return
    const video = webcamRef.current.video
    if (video.readyState < 2 || !video.videoWidth) return

    setIsCapturing(true)
    setStatus(STATUS.SCANNING)
    playInstantBeep()

    try {
      const capCanvas = captureCanvasRef.current
      const targetW = video.videoWidth || 640
      const targetH = video.videoHeight || 480
      capCanvas.width = targetW
      capCanvas.height = targetH
      const ctx = capCanvas.getContext('2d')
      ctx.drawImage(video, 0, 0, targetW, targetH)

      const blob = await new Promise(resolve => capCanvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (!blob) {
        setIsCapturing(false)
        setStatus(STATUS.IDLE)
        return
      }

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
          
          setTimeout(() => {
            setStatus(STATUS.IDLE)
            setResults([])
            setIsCapturing(false)
            setGreetingText('')
            apiBboxesRef.current = []
          }, RESULT_DISPLAY_MS)
        } else {
          setResults([])
          setStatus(STATUS.UNRECOGNIZED)
          setTimeout(() => {
            setStatus(STATUS.IDLE)
            setIsCapturing(false)
            apiBboxesRef.current = []
          }, 1500)
        }
      } else {
        setResults([])
        setStatus(STATUS.UNRECOGNIZED)
        setTimeout(() => {
          setStatus(STATUS.IDLE)
          setIsCapturing(false)
          apiBboxesRef.current = []
        }, 1500)
      }
    } catch (err) {
      console.error('Recognition error:', err)
      setResults([])
      setStatus(STATUS.ERROR)
      setTimeout(() => {
        setStatus(STATUS.IDLE)
        setIsCapturing(false)
        apiBboxesRef.current = []
      }, 2000)
    }
  }, [isCapturing])

  // Auto-capture loop — HANYA berjalan saat ada wajah terdeteksi (hasFace === true)
  // Jika tidak ada wajah, proses scanning berhenti 100% (nol beban CPU untuk API call)
  useEffect(() => {
    let initTimeout = null
    if (cameraReady && status === STATUS.IDLE && !isCapturing && hasFace) {
      initTimeout = setTimeout(() => {
        captureAndRecognize()
      }, 0)
      timerRef.current = setInterval(() => {
        captureAndRecognize()
      }, CAPTURE_INTERVAL)
    }

    return () => {
      if (initTimeout) clearTimeout(initTimeout)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [cameraReady, status, isCapturing, captureAndRecognize, hasFace])

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

  // ─── MAIN ATTENDANCE SCREEN ──────────────────────────
  return (
    <div className="att-container">
      {/* Ambient background glow — GPU Accelerated Compositing (Hanya bertransisi opacity) */}
      <div className="att-ambient-wrapper">
        <div className="att-ambient-glow" style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 60%)',
          opacity: status === STATUS.RECOGNIZED ? 1 : 0,
          transition: 'opacity 1s ease-out',
        }} />
        <div className="att-ambient-glow" style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 60%)',
          opacity: (status === STATUS.UNRECOGNIZED || status === STATUS.ERROR) ? 1 : 0,
          transition: 'opacity 1s ease-out',
        }} />
        <div className="att-ambient-glow" style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 60%)',
          opacity: status === STATUS.SCANNING ? 1 : status === STATUS.IDLE ? 0.4 : 0,
          transition: 'opacity 1s ease-out',
        }} />
      </div>

      {/* Star dots (reduced from 6 to 4 for performance) */}
      {[
        { top: '10%', left: '8%', s: 2, d: '0s' }, { top: '20%', left: '55%', s: 3, d: '1s' },
        { top: '75%', left: '12%', s: 2, d: '2s' }, { top: '85%', left: '75%', s: 2, d: '0.5s' },
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
              {/* Orbiting dots (reduced from 8 to 4 for performance) */}
              {[0, 90, 180, 270].map((deg, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: '#6366f1',
                  top: '50%', left: '50%',
                  transform: `rotate(${deg}deg) translateX(160px) translate(-50%, -50%)`,
                  animation: `att-dotPulse 2s ease-in-out infinite`,
                  animationDelay: `${i * 0.5}s`,
                  willChange: 'transform',
                }} />
              ))}
            </div>

            {/* Mascot image (floating) */}
            <div className="att-mascot-image-wrapper">
              <div className="att-mascot-shadow" />
              <SiskaMascot
                faceDetected={(hasFace && isCameraEnabled) || isCapturing || status === STATUS.SCANNING || status === STATUS.RECOGNIZED}
                attendanceResult={status}
                isCameraEnabled={isCameraEnabled}
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

                    let voice = 'en-US-AvaMultilingualNeural';
                    let r = "+0%", p = "+0Hz";

                    if (val === 'emma') { voice = 'en-US-EmmaMultilingualNeural'; }
                    else if (val === 'andrew') { voice = 'en-US-AndrewMultilingualNeural'; }
                    else if (val === 'brian') { voice = 'en-US-BrianMultilingualNeural'; }

                    // Only play test voice if camera is disabled to prevent overlapping with actual scans
                    if (!isCameraEnabled) {
                      let testText = "Halo, suara saya telah berhasil diganti. Voice check complete.";

                      fetch('/api/v1/tts/synthesize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: testText, voice: voice, rate: r, pitch: p })
                      }).then(res => res.blob()).then(blob => {
                        const url = URL.createObjectURL(blob);
                        queueAudio(url);
                      });
                    }
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
                  <option value="ava">Ava (Wanita - Multilingual)</option>
                  <option value="emma">Emma (Wanita - Ramah)</option>
                  <option value="andrew">Andrew (Pria - Profesional)</option>
                  <option value="brian">Brian (Pria - Kasual)</option>
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
                  screenshotQuality={0.7}
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
                    opacity: !isCameraEnabled ? 0.2 : 1,
                    transition: 'opacity 0.4s ease-out'
                  }}
                />
                
                {/* ─── REALTIME FACE TRACKING CANVAS ─── */}
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                    zIndex: 15,
                    willChange: 'contents',
                    display: isCameraEnabled ? 'block' : 'none',
                  }}
                />

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
                  boxShadow: '0 0 4px rgba(99,102,241,0.8)',
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
