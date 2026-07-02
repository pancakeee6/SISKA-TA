import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserCheck, Clock, TrendingUp, TrendingDown,
  UserPlus, ClipboardList, ScanFace, Download,
  ArrowRight, Bell,
} from 'lucide-react'
import dashboardApi from '../services/dashboardApi'
import userApi from '../services/userApi'
import api from '@shared/services/api'
import useWebSocket from '@shared/hooks/useWebSocket'
import siskaMascot from '@/assets/siska-mascot.png'

// --- Greeting helper ---
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

// --- Live Clock Component ---
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{
        fontSize: '12px',
        color: '#94a3b8',
        marginBottom: '2px',
      }}>{formatDate(time)}</p>
      <p style={{
        fontSize: '34px',
        fontWeight: 700,
        color: '#ffffff',
        fontFamily: 'monospace',
        letterSpacing: '2px',
        lineHeight: 1,
      }}>{formatTime(time)}</p>
    </div>
  )
}

// --- Donut Ring Component ---
function AttendanceDonut({ percentage, size = 64, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="rgba(56, 189, 248, 0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="url(#donut-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="donut-ring"
        />
        <defs>
          <linearGradient id="donut-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{percentage}%</span>
      </div>
    </div>
  )
}

// --- Star/Sparkle decorative component ---
function StarDecoration() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Large glowing dots */}
      {[
        { top: '15%', left: '20%', size: 4, opacity: 0.6, delay: '0s' },
        { top: '25%', left: '45%', size: 3, opacity: 0.4, delay: '0.5s' },
        { top: '10%', left: '55%', size: 5, opacity: 0.5, delay: '1s' },
        { top: '35%', left: '35%', size: 3, opacity: 0.3, delay: '1.5s' },
        { top: '20%', left: '70%', size: 4, opacity: 0.4, delay: '0.8s' },
        { top: '40%', left: '25%', size: 2, opacity: 0.5, delay: '2s' },
        { top: '30%', left: '60%', size: 3, opacity: 0.6, delay: '0.3s' },
        { top: '45%', left: '50%', size: 2, opacity: 0.3, delay: '1.2s' },
      ].map((star, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            borderRadius: '50%',
            background: '#ffffff',
            opacity: star.opacity,
            animation: `twinkle 3s ease-in-out ${star.delay} infinite`,
          }}
        />
      ))}
    </div>
  )
}

// --- Quick Actions ---
const quickActions = [
  { label: 'Tambah\nPengguna', icon: UserPlus, to: '/admin/users', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  { label: 'Riwayat\nAbsensi', icon: ClipboardList, to: '/admin/attendance', color: '#14b8a6', bgColor: 'rgba(20, 184, 166, 0.15)' },
  { label: 'Kelola\nWajah', icon: ScanFace, to: '/admin/faces', color: '#a78bfa', bgColor: 'rgba(167, 139, 250, 0.15)' },
  { label: 'Export\nLaporan', icon: Download, to: '/admin/reports', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
]

// --- Stat Cards Config ---
const statCards = [
  {
    key: 'total',
    label: 'Total Pengguna',
    icon: Users,
    iconBg: 'rgba(59, 130, 246, 0.15)',
    iconColor: '#3b82f6',
    borderColor: 'rgba(59, 130, 246, 0.15)',
    bgColor: 'rgba(59, 130, 246, 0.06)',
  },
  {
    key: 'present',
    label: 'Hadir Hari Ini',
    icon: UserCheck,
    iconBg: 'rgba(20, 184, 166, 0.15)',
    iconColor: '#14b8a6',
    borderColor: 'rgba(20, 184, 166, 0.15)',
    bgColor: 'rgba(20, 184, 166, 0.06)',
  },
  {
    key: 'late',
    label: 'Terlambat Hari Ini',
    icon: Clock,
    iconBg: 'rgba(251, 191, 36, 0.15)',
    iconColor: '#fbbf24',
    borderColor: 'rgba(251, 191, 36, 0.15)',
    bgColor: 'rgba(251, 191, 36, 0.06)',
  },
]

// Day labels for chart
const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, absent: 0 })
  const [weeklyStats, setWeeklyStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState([])

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, weeklyRes, usersRes, eventsRes] = await Promise.allSettled([
        dashboardApi.getStats(),
        dashboardApi.getWeekly(),
        userApi.list({ limit: 1 }),
        api.get('/api/v1/attendance/logs', { params: { per_page: 6 } })
      ])

      if (statsRes.status === 'fulfilled') {
        const statsData = statsRes.value.data
        const totalUsers = usersRes.status === 'fulfilled'
          ? (usersRes.value.data.total || usersRes.value.data.items?.length || usersRes.value.data.users?.length || 0)
          : 0
        setStats({ ...statsData, total: totalUsers, absent: Math.max(0, totalUsers - statsData.present) })
      }
      if (weeklyRes.status === 'fulfilled') {
        setWeeklyStats(weeklyRes.value.data)
      }
      if (eventsRes.status === 'fulfilled') {
        const rawLogs = eventsRes.value.data?.logs || eventsRes.value.data?.items || []
        const latestEvents = rawLogs.map(r => ({
          id: r.id || `${r.timestamp}-${r.user_name}`,
          user_name: r.user_name || 'Unknown',
          event_type: r.event_type || 'IN',
          timestamp: r.timestamp,
          late: r.late
        }))
        setActivities(latestEvents)
      }
    } catch {
      // Silently fail
    } finally {
      if (loading) setLoading(false)
    }
  }, [loading])

  // WebSocket for realtime attendance updates
  const handleWsMessage = useCallback((message) => {
    if (message.type === 'attendance_marked' || message.event === 'attendance_marked') {
      const newAct = {
        id: `${Date.now()}-${message.data?.user_name}`,
        user_name: message.data?.user_name || 'Unknown',
        event_type: message.data?.event_type || 'IN',
        timestamp: message.data?.timestamp || new Date().toISOString(),
        late: message.data?.late || false,
      }
      setActivities((prev) => [newAct, ...prev].slice(0, 6))
      fetchDashboardData()
    }
  }, [fetchDashboardData])

  useWebSocket({
    enabled: true,
    onMessage: handleWsMessage,
  })

  useEffect(() => {
    setTimeout(() => fetchDashboardData(), 0)
  }, [fetchDashboardData])

  // Attendance rate
  const attendanceRate = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0

  // Prepare chart data — use weekly stats or fallback sample data
  const chartData = weeklyStats.length > 0
    ? weeklyStats.map((d, i) => ({
        day: d.day || dayLabels[i] || `D${i + 1}`,
        hadir: d.present || 0,
        terlambat: d.late || 0,
      }))
    : dayLabels.map((day) => ({ day, hadir: 0, terlambat: 0 }))

  const maxChartValue = Math.max(
    ...chartData.map((d) => d.hadir + d.terlambat),
    1
  )

  // Display activities (strictly real data from API/WS)
  const displayActivities = activities.map((act) => {
    const isLate = act.late
    const isCheckIn = act.event_type === 'IN'
    return {
      id: act.id,
      user_name: act.user_name,
      action: isCheckIn ? 'melakukan check in' : 'melakukan check out',
      time: act.timestamp
        ? new Date(act.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '-',
      status: isLate ? 'Terlambat' : (isCheckIn ? 'Hadir' : 'Keluar'),
      statusColor: isLate ? '#d97706' : (isCheckIn ? '#059669' : '#475569'),
      statusBg: isLate ? '#fef3c7' : (isCheckIn ? '#d1fae5' : '#f1f5f9'),
    }
  })

  return (
    <div style={{ width: '100%' }} className="animate-fade-in">
      {/* Twinkle animation keyframes */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.5); }
        }
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .hero-content { padding-right: 200px; }
        .hero-mascot { display: flex; }
        .stats-grid { grid-template-columns: repeat(4, 1fr); }
        .chart-grid { grid-template-columns: 1fr 1fr; }
        .hero-box { padding: 32px 36px; min-height: 220px; }
        .greeting-title { font-size: 30px; }
        .greeting-sub { font-size: 14px; }
        .clock-time { font-size: 34px; }
        .clock-date { font-size: 12px; }
        .qa-btn { width: 105px; height: 95px; gap: 10px; }
        .qa-icon { width: 40px; height: 40px; }
        .qa-label { font-size: 11px; }
        .stat-number { font-size: 40px; }
        .stat-label { font-size: 13px; }
        .bell-btn { padding: 10px; }
        .bell-btn svg { width: 18px; height: 18px; }
        @media (max-width: 1024px) {
          .hero-content { padding-right: 0 !important; }
          .hero-mascot { display: none !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .greeting-title { font-size: 24px !important; }
          .clock-time { font-size: 26px !important; }
        }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .chart-grid { grid-template-columns: 1fr !important; }
          .hero-box { padding: 20px 20px !important; min-height: 180px !important; }
          .greeting-title { font-size: 20px !important; }
          .greeting-sub { font-size: 12px !important; }
          .clock-time { font-size: 20px !important; letter-spacing: 1px !important; }
          .clock-date { font-size: 10px !important; }
          .qa-btn { width: 78px !important; height: 72px !important; gap: 6px !important; border-radius: 12px !important; }
          .qa-icon { width: 30px !important; height: 30px !important; border-radius: 8px !important; }
          .qa-icon svg { width: 15px !important; height: 15px !important; }
          .qa-label { font-size: 9px !important; }
          .stat-number { font-size: 28px !important; }
          .stat-label { font-size: 11px !important; }
          .bell-btn { padding: 7px !important; border-radius: 8px !important; }
          .bell-btn svg { width: 15px !important; height: 15px !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr !important; }
          .hero-box { padding: 16px 16px !important; min-height: 160px !important; }
          .greeting-title { font-size: 18px !important; }
          .clock-time { font-size: 18px !important; }
          .qa-btn { width: 68px !important; height: 64px !important; }
          .qa-icon { width: 26px !important; height: 26px !important; }
          .qa-label { font-size: 8px !important; }
        }
      `}</style>

      {/* ========== 1. HERO HEADER ========== */}
      <div
        className="animate-fade-up hero-box"
        style={{
          position: 'relative',
          borderRadius: '24px',
          overflow: 'hidden',
          padding: '32px 36px',
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 10px 30px -10px rgba(37, 99, 235, 0.3)',
          minHeight: '220px',
          marginBottom: '24px',
        }}
      >

        {/* Star decorations */}
        <StarDecoration />

        {/* Background blobs */}
        <div className="blob" style={{
          width: '200px', height: '200px',
          top: '-60px', right: '200px',
          background: 'rgba(255, 255, 255, 0.15)',
          animation: 'glowPulse 4s ease-in-out infinite',
        }} />
        <div className="blob" style={{
          width: '150px', height: '150px',
          bottom: '-40px', left: '30%',
          background: 'rgba(255, 255, 255, 0.1)',
          animation: 'glowPulse 4s ease-in-out 1.5s infinite',
        }} />


        <div style={{
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Top row: Greeting left, Clock+Bell right — always side by side */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}>
            {/* Left: Greeting */}
            <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="greeting-title" style={{
              fontSize: '30px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.2,
              margin: 0,
            }}>
              {getGreeting()}, Admin! 👋
            </h1>
            <p className="greeting-sub" style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.85)',
              marginTop: '6px',
            }}>
              SISKA siap membantu memantau kehadiran dengan AI
            </p>
            </div>

            {/* Right: Clock + Bell — always stays at top right */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              flexShrink: 0,
              zIndex: 2,
            }}>
              <LiveClock />
              <button className="bell-btn" style={{
                position: 'relative',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '12px',
                padding: '10px',
                cursor: 'pointer',
                color: '#ffffff',
                transition: 'all 0.2s',
              }}>
                <Bell size={18} />
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>3</span>
              </button>
            </div>
          </div>

          {/* Quick Actions — below greeting, respects mascot space on desktop */}
          <div className="hero-content">
            <div style={{
              display: 'flex',
              gap: '14px',
              flexWrap: 'wrap',
            }}>
              {quickActions.map(({ label, icon: Icon, to, color, bgColor }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className="card-hover qa-btn"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '105px',
                    height: '95px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div className="qa-icon" style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: `${color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <span className="qa-label" style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#334155',
                    textAlign: 'center',
                    lineHeight: 1.3,
                    whiteSpace: 'pre-line',
                  }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mascot - Half body, positioned center-right to avoid blocking clock */}
        <div className="hero-mascot" style={{
          position: 'absolute',
          right: '250px',
          top: '0',
          bottom: '0',
          width: '200px',
          zIndex: 1,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '8px',
        }}>
          <img
            src={siskaMascot}
            alt="SISKA Mascot"
            style={{
              width: '200px',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.3))',
              animation: 'mascotFloat 5s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* ========== 2. STATISTICS CARDS ========== */}
      <div className="stats-grid animate-fade-up stagger-2" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {statCards.map(({ key, label, icon: Icon, iconBg, iconColor, borderColor }) => (
          <div
            key={key}
            className="card-hover"
            style={{
              borderRadius: '16px',
              padding: '20px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Top: icon + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={18} style={{ color: iconColor }} />
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, margin: 0 }}>{label}</p>
            </div>

            {/* Big number */}
            {loading ? (
              <div style={{
                height: '44px', width: '80px',
                background: '#f1f5f9',
                borderRadius: '8px',
              }} className="animate-pulse" />
            ) : (
              <p style={{
                fontSize: '40px',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1,
              }}>{stats[key]}</p>
            )}

            {/* Trend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              {key === 'total' && (
                <>
                  <TrendingUp style={{ width: '12px', height: '12px', color: '#10b981' }} />
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>
                    {stats.total > 0 ? `${stats.total} dari minggu lalu` : '—'}
                  </span>
                </>
              )}
              {key === 'present' && (
                <>
                  <TrendingUp style={{ width: '12px', height: '12px', color: '#10b981' }} />
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>
                    {stats.present > 0 ? `${stats.present} dari kemarin` : '—'}
                  </span>
                </>
              )}
              {key === 'late' && (
                <>
                  <TrendingDown style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>
                    {stats.late > 0 ? `${stats.late} dari kemarin` : '—'}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Attendance Rate Card */}
        <div
          className="card-hover"
          style={{
            borderRadius: '16px',
            padding: '20px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s ease',
          }}
        >
          <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, margin: 0, marginBottom: '12px' }}>Tingkat Kehadiran</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {loading ? (
              <div style={{
                height: '44px', width: '80px',
                background: '#f1f5f9',
                borderRadius: '8px',
              }} className="animate-pulse" />
            ) : (
              <p style={{
                fontSize: '40px',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1,
              }}>{attendanceRate}%</p>
            )}
            <div style={{ flexShrink: 0 }}>
              {loading ? (
                <div style={{
                  width: '64px', height: '64px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                }} className="animate-pulse" />
              ) : (
                <AttendanceDonut percentage={attendanceRate} />
              )}
            </div>
          </div>
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              {attendanceRate >= 90 ? (
                <>
                  <TrendingUp style={{ width: '12px', height: '12px', color: '#10b981' }} />
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>5% dari minggu lalu</span>
                </>
              ) : (
                <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 500 }}>Perlu perhatian</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========== 3. CHART + ACTIVITY ========== */}
      <div className="chart-grid animate-fade-up stagger-3" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
      }}>

        {/* Weekly Bar Chart */}
        <div style={{
          borderRadius: '16px',
          padding: '24px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#0f172a',
            margin: 0,
            marginBottom: '24px',
          }}>Absensi 7 Hari Terakhir</h2>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '200px' }}>
              {[...Array(7)].map((_, i) => (
                <div key={i} style={{
                  flex: 1,
                  height: `${30 + ((i * 17) % 60)}%`,
                  background: '#f1f5f9',
                  borderRadius: '6px',
                }} className="animate-pulse" />
              ))}
            </div>
          ) : (
            <div>
              {/* Y-axis labels + bars */}
              <div style={{ display: 'flex', gap: '8px', height: '220px' }}>
                {/* Y-axis */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  paddingBottom: '24px',
                  width: '30px',
                  flexShrink: 0,
                }}>
                  {[30, 20, 10, 0].map((val) => (
                    <span key={val} style={{
                      fontSize: '11px',
                      color: '#64748b',
                      textAlign: 'right',
                    }}>{val}</span>
                  ))}
                </div>

                {/* Bars */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '8px',
                  paddingBottom: '24px',
                  position: 'relative',
                }}>
                  {/* Grid lines */}
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: `${24 + (i * (196 / 3))}px`,
                      height: '1px',
                      background: '#f1f5f9',
                    }} />
                  ))}

                  {chartData.map((d, i) => {
                    const hadirHeight = maxChartValue > 0 ? (d.hadir / 30) * 196 : 0
                    const terlambatHeight = maxChartValue > 0 ? (d.terlambat / 30) * 196 : 0

                    return (
                      <div key={i} style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0',
                        height: '100%',
                        justifyContent: 'flex-end',
                        position: 'relative',
                      }}>
                        {/* Bar group */}
                        <div style={{
                          display: 'flex',
                          gap: '3px',
                          alignItems: 'flex-end',
                          width: '100%',
                          justifyContent: 'center',
                        }}>
                          {/* Hadir bar */}
                          <div style={{
                            width: '14px',
                            height: `${Math.max(hadirHeight, 4)}px`,
                            borderRadius: '4px 4px 2px 2px',
                            background: 'linear-gradient(180deg, #3b82f6, #2563eb)',
                            transition: 'height 0.7s ease',
                          }} />
                          {/* Terlambat bar */}
                          <div style={{
                            width: '14px',
                            height: `${Math.max(terlambatHeight, 4)}px`,
                            borderRadius: '4px 4px 2px 2px',
                            background: 'linear-gradient(180deg, #f59e0b, #d97706)',
                            transition: 'height 0.7s ease',
                          }} />
                        </div>
                        {/* Day label */}
                        <span style={{
                          fontSize: '11px',
                          color: '#64748b',
                          fontWeight: 500,
                          marginTop: '8px',
                          position: 'absolute',
                          bottom: '-20px',
                        }}>{d.day}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Legend */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px',
                marginTop: '20px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#2563eb' }} />
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>Hadir</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#d97706' }} />
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>Terlambat</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div style={{
          borderRadius: '16px',
          padding: '24px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#0f172a',
            margin: 0,
            marginBottom: '20px',
          }}>Aktivitas Terbaru</h2>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayActivities.length === 0 ? (
              <div style={{
                padding: '36px 20px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '13px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1',
              }}>
                Belum ada aktivitas absensi tercatat. Data akan muncul secara langsung (realtime) saat pengguna melakukan absensi.
              </div>
            ) : (
              displayActivities.map((act, i) => (
                <div
                  key={act.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(37, 99, 235, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                    fontSize: '13px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {act.user_name?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '13px',
                      color: '#0f172a',
                      fontWeight: 600,
                      margin: 0,
                      lineHeight: 1.3,
                    }}>
                      {act.user_name} <span style={{ color: '#64748b', fontWeight: 400 }}>{act.action}</span>
                    </p>
                    <p style={{
                      fontSize: '11px',
                      color: '#94a3b8',
                      margin: 0,
                      marginTop: '2px',
                    }}>{act.time}</p>
                  </div>

                  {/* Status badge */}
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: act.statusBg,
                    border: `1px solid ${act.statusColor}30`,
                    fontSize: '11px',
                    fontWeight: 600,
                    color: act.statusColor,
                    flexShrink: 0,
                  }}>{act.status}</div>
                </div>
              ))
            )}
          </div>

          {/* See all link */}
          <button
            onClick={() => navigate('/admin/attendance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '6px',
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid #f1f5f9',
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'color 0.2s',
              width: '100%',
            }}
          >
            Lihat semua aktivitas <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
