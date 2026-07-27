import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserCheck, Clock, TrendingUp, TrendingDown, Activity, Download, UserPlus, Briefcase
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import dashboardApi from '../services/dashboardApi'
import api from '@shared/services/api'
import useWebSocket from '@shared/hooks/useWebSocket'



// --- Donut Ring Component ---
function AttendanceDonut({ percentage, size = 64, strokeWidth = 6 }) {
  const cappedPercentage = Math.min(100, Math.max(0, Math.round(percentage || 0)))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (cappedPercentage / 100) * circumference

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="rgba(99, 102, 241, 0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="url(#donut-gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
        <defs>
          <linearGradient id="donut-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#818cf8" />
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
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{cappedPercentage}%</span>
      </div>
    </div>
  )
}

// --- Stat Cards Config ---
const statCards = [
  {
    key: 'total',
    label: 'Total Pengguna',
    icon: Users,
    iconBg: 'rgba(59, 130, 246, 0.1)',
    iconColor: '#3b82f6',
    getValue: (s) => s.total || 0,
  },
  {
    key: 'onTime',
    label: 'Tepat Waktu',
    icon: UserCheck,
    iconBg: 'rgba(16, 185, 129, 0.1)',
    iconColor: '#10b981',
    getValue: (s) => Math.max(0, (s.present || 0) - (s.late || 0)),
  },
  {
    key: 'late',
    label: 'Terlambat Hari Ini',
    icon: Clock,
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconColor: '#f59e0b',
    getValue: (s) => s.late || 0,
  },
]

// Day labels for chart
const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

// Helper untuk normalisasi event_type (Masuk & Pulang) serta deduplikasi absen per Shift:
// Shift 1: 08.00 - 15.00 (hour < 15.0)
// Shift 2: 15.00 - 21.00 (hour >= 15.0)
// Mengabaikan duplikat kamera dalam jeda singkat (< 5 menit) agar hanya absen pertama yang tersimpan/tampil sebagai Masuk,
// dan scan berikutnya di atas 5 menit dalam shift yang sama menjadi Pulang.
const normalizeAttendanceLogs = (logs) => {
  if (!logs || !Array.isArray(logs)) return [];

  const sorted = [...logs].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
  const shiftTrackers = {};
  const normalizedMap = new Map();
  const resultIds = [];

  sorted.forEach(log => {
    if (!log.timestamp) return;
    if (log.category === 'ADMIN' || log.status === 'dinas' || (log.event_type !== 'IN' && log.event_type !== 'OUT')) {
      const generatedId = log.id || Math.random();
      normalizedMap.set(generatedId, log);
      resultIds.push(generatedId);
      return;
    }
    const dt = new Date(log.timestamp);
    if (isNaN(dt.getTime())) {
      normalizedMap.set(log.id || Math.random(), log);
      return;
    }

    const dateStr = log.timestamp.split('T')[0];
    const hour = dt.getHours() + (dt.getMinutes() / 60);
    const shiftLabel = hour < 15 ? 'Shift Pagi' : 'Shift Sore';
    const userId = log.user_name || log.user_id || log.employee_id || log.full_name || 'unknown';
    // Group by user, date, and shift to split reports per shift
    const userShiftKey = `${userId}_${dateStr}_${shiftLabel}`;

    if (!shiftTrackers[userShiftKey]) {
      shiftTrackers[userShiftKey] = {
        firstScanTime: dt,
        lastScanTime: dt,
        inLogId: log.id,
        outLogId: null
      };
      normalizedMap.set(log.id, {
        ...log,
        event_type: 'IN',
        shift_label: shiftLabel
      });
      resultIds.push(log.id);
    } else {
      const diffSec = (dt - shiftTrackers[userShiftKey].lastScanTime) / 1000;

      if (diffSec < 300 && !shiftTrackers[userShiftKey].outLogId) {
        shiftTrackers[userShiftKey].lastScanTime = dt;
        return;
      }

      shiftTrackers[userShiftKey].lastScanTime = dt;
      if (shiftTrackers[userShiftKey].outLogId) {
        const oldOutId = shiftTrackers[userShiftKey].outLogId;
        normalizedMap.delete(oldOutId);
        const idx = resultIds.indexOf(oldOutId);
        if (idx !== -1) resultIds.splice(idx, 1);
      }

      shiftTrackers[userShiftKey].outLogId = log.id;
      normalizedMap.set(log.id, {
        ...log,
        event_type: 'OUT',
        shift_label: shiftLabel
      });
      resultIds.push(log.id);
    }
  });

  const finalLogs = resultIds.map(id => normalizedMap.get(id)).filter(Boolean);
  return finalLogs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
};

export default function DashboardPage() {
  const navigate = useNavigate()
  
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, absent: 0 })
  const [dailyStats, setDailyStats] = useState([])
  const [weeklyStats, setWeeklyStats] = useState([])
  const [monthlyStats, setMonthlyStats] = useState([])
  const [chartRange, setChartRange] = useState('daily')
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState([])

  const fetchDashboardData = useCallback(async () => {
    try {
      try {
        const summaryRes = await dashboardApi.getSummary()
        if (summaryRes.data) {
          const { stats: statsData = {}, daily = [], weekly = [], monthly = [], activities: rawActivities = [] } = summaryRes.data
          const totalUsers = statsData.total || 0
          setStats({
            ...statsData,
            total: totalUsers,
            absent: Math.max(0, totalUsers - (statsData.present || 0))
          })
          setDailyStats(daily)
          setWeeklyStats(weekly)
          setMonthlyStats(monthly)

          const latestEvents = (rawActivities || [])
            .filter(r => r.category === 'ATTENDANCE' || (r.category !== 'ADMIN' && (r.event_type === 'IN' || r.event_type === 'OUT')))
            .map(r => ({
              id: r.id || `${r.timestamp}-${r.user_name}`,
              user_name: r.user_name || 'Unknown',
              event_type: r.event_type || 'IN',
              timestamp: r.timestamp,
              late: r.late,
              category: 'ATTENDANCE'
            }))
          setActivities(normalizeAttendanceLogs(latestEvents))
          return
        }
      } catch {
        // Fallback to individual calls if summary endpoint is unavailable
      }

      const [statsRes, dailyRes, weeklyRes, monthlyRes, eventsRes] = await Promise.allSettled([
        dashboardApi.getStats(),
        dashboardApi.getDaily(),
        dashboardApi.getWeekly(),
        dashboardApi.getMonthly(),
        api.get('/api/v1/dashboard/activities', { params: { limit: 5 } })
      ])

      if (statsRes.status === 'fulfilled') {
        const statsData = statsRes.value.data
        const totalUsers = statsData.total || 0
        setStats({ ...statsData, total: totalUsers, absent: Math.max(0, totalUsers - (statsData.present || 0)) })
      }
      if (dailyRes.status === 'fulfilled') {
        setDailyStats(dailyRes.value.data)
      }
      if (weeklyRes.status === 'fulfilled') {
        setWeeklyStats(weeklyRes.value.data)
      }
      if (monthlyRes.status === 'fulfilled') {
        setMonthlyStats(monthlyRes.value.data)
      }
      if (eventsRes.status === 'fulfilled') {
        const rawLogs = eventsRes.value.data?.logs || eventsRes.value.data?.items || []
        const latestEvents = rawLogs
          .filter(r => r.category === 'ATTENDANCE' || (r.category !== 'ADMIN' && (r.event_type === 'IN' || r.event_type === 'OUT')))
          .map(r => ({
            id: r.id || `${r.timestamp}-${r.user_name}`,
            user_name: r.user_name || 'Unknown',
            event_type: r.event_type || 'IN',
            timestamp: r.timestamp,
            late: r.late,
            category: 'ATTENDANCE'
          }))
        setActivities(normalizeAttendanceLogs(latestEvents))
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
      setActivities((prev) => normalizeAttendanceLogs([newAct, ...prev]).slice(0, 6))
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

  // Attendance rate (present already includes late from backend, we add dinas for total attending)
  const attendanceRate = stats.total > 0
    ? Math.min(100, Math.round(((stats.present + (stats.dinas || 0)) / stats.total) * 100))
    : 0

  // Prepare chart data
  const activeStats = chartRange === 'daily' ? dailyStats : (chartRange === 'monthly' ? monthlyStats : weeklyStats)
  const chartData = activeStats.length > 0
    ? activeStats.map((d, i) => {
      if (chartRange === 'monthly') {
        return {
          day: d.day, // "Jan", "Feb", etc.
          fullDay: d.full_name || d.day, // "Jan 2026"
          hadir: Math.max(0, (d.present || 0) - (d.late || 0)),
          terlambat: d.late || 0
        }
      }
      if (chartRange === 'daily') {
        return {
          day: d.day, // "08:00"
          fullDay: d.full_name || d.day, // "Jam 08:00"
          hadir: Math.max(0, (d.present || 0) - (d.late || 0)),
          terlambat: d.late || 0
        }
      }

      const [enDay, datePart] = (d.day || '').split(' ')
      const dayMap = { Mon: 'Senin', Tue: 'Selasa', Wed: 'Rabu', Thu: 'Kamis', Fri: 'Jumat', Sat: 'Sabtu', Sun: 'Minggu' }
      const shortDayMap = { Mon: 'Sen', Tue: 'Sel', Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab', Sun: 'Min' }

      // Format date from "DD/MM" to "D MMM" (e.g., "04/07" -> "4 Jul")
      const [dDate, mMonth] = (datePart || '').split('/')
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"]
      const monthName = mMonth ? monthNames[parseInt(mMonth, 10) - 1] : ''
      const formattedDate = dDate && mMonth ? `${parseInt(dDate, 10)} ${monthName}` : datePart

      let idDay = shortDayMap[enDay] || enDay || dayLabels[i] || `H-${i + 1}`
      if (!idDay) idDay = d.day

      return {
        day: idDay,
        fullDay: dayMap[enDay] ? `${dayMap[enDay]}, ${formattedDate}` : d.day,
        hadir: Math.max(0, (d.present || 0) - (d.late || 0)),
        terlambat: d.late || 0
      }
    })
    : dayLabels.map((day) => ({ day, hadir: 0, terlambat: 0 }))

  // Display activities (strictly real data from API/WS + demo mock)
  const displayActivities = activities.filter((act) => {
    if (!act.timestamp) return false;
    const actDate = new Date(act.timestamp).setHours(0, 0, 0, 0);
    const todayDate = new Date().setHours(0, 0, 0, 0);
    return actDate === todayDate;
  }).map((act) => {
    const isLate = act.late
    const isDinas = act.status === 'dinas' || act.event_type === 'DINAS'
    const isCheckIn = act.event_type === 'IN' && !isDinas
    const isExport = act.event_type === 'EXPORT'
    const isRegister = act.event_type === 'REGISTER'
    const isDelete = act.event_type === 'DELETE'

    let actionText = `Berhasil melakukan presensi pulang${act.shift_label ? ` (${act.shift_label})` : ''}`
    let statusText = 'Pulang'
    let sColor = '#4f46e5'
    let sBg = '#e0e7ff'

    if (isDinas) {
      let dinasKet = act.device_id || act.shift_label || 'Perizinan'
      if (typeof act.device_id === 'string' && act.device_id.startsWith('{')) {
        try {
          const parsed = JSON.parse(act.device_id)
          dinasKet = parsed.k || 'Perizinan'
        } catch { /* ignore */ }
      }
      actionText = `Mencatat Perizinan (${dinasKet})`
      statusText = 'Izin'
      sColor = '#6366f1'
      sBg = '#e0e7ff'
    } else if (isCheckIn) {
      actionText = `Berhasil melakukan presensi masuk${act.shift_label ? ` (${act.shift_label})` : ''}`
      if (isLate) {
        let lateInfo = act.late_duration
        if (!lateInfo) {
          try {
            const d = new Date(act.timestamp)
            const hour = d.getHours()
            const min = d.getMinutes()
            let shiftHour = 8
            if (hour >= 15) shiftHour = 15
            const diffMins = Math.max(1, (hour - shiftHour) * 60 + min)
            const hours = Math.floor(diffMins / 60)
            const mins = diffMins % 60
            if (hours > 0 && mins > 0) {
              lateInfo = `${hours} jam ${mins} menit`
            } else if (hours > 0) {
              lateInfo = `${hours} jam`
            } else {
              lateInfo = `${mins} menit`
            }
          } catch {
            lateInfo = ''
          }
        }
        if (lateInfo) {
          actionText = `Berhasil melakukan presensi masuk${act.shift_label ? ` (${act.shift_label})` : ''} (Terlambat ${lateInfo})`
        }
      }
      statusText = isLate ? 'Terlambat' : 'Hadir'
      sColor = isLate ? '#d97706' : '#059669'
      sBg = isLate ? '#fef3c7' : '#d1fae5'
    } else if (isExport) {
      actionText = 'Laporan bulanan berhasil diunduh'
      statusText = 'Export'
      sColor = '#7c3aed'
      sBg = '#ede9fe'
    } else if (isRegister) {
      actionText = 'Pengguna baru berhasil ditambahkan'
      statusText = 'Pengguna'
      sColor = '#2563eb'
      sBg = '#dbeafe'
    } else if (isDelete) {
      actionText = 'Pengguna berhasil dihapus'
      statusText = 'Hapus'
      sColor = '#ef4444'
      sBg = '#fee2e2'
    }

    return {
      id: act.id,
      user_name: act.user_name,
      action: actionText,
      time: (() => {
        if (!act.timestamp) return '-';
        const d = new Date(act.timestamp);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        
        const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
        
        const tStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        if (isToday) return tStr;
        if (isYesterday) return 'Kemarin';
        
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
        return `${d.getDate()} ${monthNames[d.getMonth()]} ${tStr}`;
      })(),
      status: statusText,
      statusColor: sColor,
      statusBg: sBg,
      avatarColor: sColor,
      avatarBg: sBg
    }
  })

  // --- Dynamic Trend Logic ---
  const todayData = chartData[chartData.length - 1]
  const yesterdayData = chartData[chartData.length - 2]

  let trendMessage = "Data kehadiran belum cukup untuk membandingkan tren."
  let TrendIcon = Activity
  let trendIconColor = "#6b7280"
  let trendBg = "var(--color-bg-base)"
  let trendTextColor = "var(--color-text-secondary)"

  if (todayData && yesterdayData && yesterdayData.fullDay) {
    if (todayData.hadir > yesterdayData.hadir) {
      trendMessage = `Tingkat kehadiran hari ini (${todayData.hadir}) lebih tinggi dibandingkan kemarin (${yesterdayData.hadir}).`
      TrendIcon = TrendingUp
      trendIconColor = "#10b981"
      trendBg = "rgba(16, 185, 129, 0.1)"
      trendTextColor = "#10b981"
    } else if (todayData.hadir < yesterdayData.hadir) {
      trendMessage = `Tingkat kehadiran hari ini (${todayData.hadir}) lebih rendah dibandingkan kemarin (${yesterdayData.hadir}).`
      TrendIcon = TrendingDown
      trendIconColor = "#ef4444"
      trendBg = "rgba(239, 68, 68, 0.1)"
      trendTextColor = "#ef4444"
    } else {
      trendMessage = `Tingkat kehadiran hari ini sama persis dengan hari kemarin (${todayData.hadir} orang).`
      TrendIcon = TrendingUp
      trendIconColor = "#3b82f6"
      trendBg = "rgba(59, 130, 246, 0.1)"
      trendTextColor = "#3b82f6"
    }
  }

  // Mock trend data logic
  const getTrendData = (key) => {
    if (key === 'total') return { value: '↑ 2 dari minggu lalu', color: '#10b981' }
    if (key === 'present') return { value: '↑ 5 dari kemarin', color: '#10b981' }
    if (key === 'late') return { value: '↓ 1 dari kemarin', color: '#10b981' }
    if (key === 'dinas') return { value: 'Izin Resmi Dosen/Pegawai', color: '#6366f1' }
    if (key === 'rate') return { value: '↑ 3% dari kemarin', color: '#10b981' }
    return { value: '↑ 3% dari kemarin', color: '#10b981' }
  }

  return (
    <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '18px' }} className="animate-fade-in dashboard-main">

      {/* ===== LEFT COLUMN: Quick Access + KPI Cards + Activity ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* 1. QUICK ACCESS (icon-only, 3 in a row) */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          {[
            { label: 'Export Laporan', icon: Download, color: '#4f46e5', bg: '#e0e7ff', path: '/admin/attendance' },
            { label: 'Tambah Pengguna', icon: UserPlus, color: '#10b981', bg: '#d1fae5', path: '/admin/users' },
            { label: 'Catat Perizinan', icon: Briefcase, color: '#6366f1', bg: '#e0e7ff', path: '/admin/attendance?action=dinas' },
          ].map((action, idx) => (
            <div
              key={idx}
              onClick={() => navigate(action.path)}
              className="hover-card"
              title={action.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                padding: '14px 8px',
                borderRadius: '14px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.25s ease',
              }}
            >
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: action.bg, color: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <action.icon size={20} strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', lineHeight: 1.2 }}>{action.label}</span>
            </div>
          ))}
        </div>

        {/* 2. KPI CARDS (2-col grid) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', flexShrink: 0 }}>
          {statCards.map((card) => {
            const { key, label, icon: Icon, iconBg, iconColor, getValue } = card;
            const trend = getTrendData(key)
            return (
              <div
                key={key}
                className="hover-card"
                style={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600, margin: 0, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
                  {loading ? (
                    <div style={{ height: '22px', width: '36px', background: 'var(--color-bg-base)', borderRadius: '6px', marginBottom: '3px' }} className="animate-pulse" />
                  ) : (
                    <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1, marginBottom: '3px' }}>
                      {getValue ? getValue(stats) : stats[key]}
                    </p>
                  )}
                  <span style={{ fontSize: '10px', fontWeight: 600, color: trend.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trend.value}
                  </span>
                </div>
              </div>
            )
          })}

          {/* 5th Card: Tingkat Kehadiran (full width) */}
          <div
            className="hover-card"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '12px 14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600, margin: 0, marginBottom: '2px' }}>Tingkat Hadir</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1 }}>
                  {attendanceRate}%
                </p>
                <AttendanceDonut percentage={attendanceRate} size={34} strokeWidth={4} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#10b981' }}>
                {getTrendData('rate').value}
              </span>
            </div>
          </div>
        </div>

        {/* 3. AKTIVITAS TERBARU */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '18px', padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>Aktivitas Terbaru</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displayActivities.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <Clock size={18} className="animate-pulse" />
                </div>
                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text-secondary)' }}>Menunggu aktivitas absen...</span>
              </div>
            ) : (
              displayActivities.slice(0, 5).map((act, i) => (
                <div key={act.id || i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '4px 0', borderBottom: i < Math.min(displayActivities.length, 5) - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '8px', background: act.avatarBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: act.avatarColor, fontSize: '13px', fontWeight: 700, flexShrink: 0
                  }}>
                    {act.user_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, gap: '6px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', margin: 0, marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {act.user_name}
                      </p>
                      <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {act.action}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
                        {act.time}
                      </span>
                      <div style={{ padding: '1px 6px', borderRadius: '4px', background: act.statusBg, color: act.statusColor, fontSize: '9px', fontWeight: 700 }}>
                        {act.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: '8px', textAlign: 'center' }}>
            <button
              onClick={() => navigate('/admin/attendance')}
              style={{
                background: 'transparent', border: 'none', padding: '4px 12px', fontSize: '11.5px',
                fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            >
              Lihat Semua ({activities.length}) →
            </button>
          </div>
        </div>

      </div>

      {/* ===== RIGHT COLUMN: Chart only ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Analytics Chart */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '22px 26px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Statistik Kehadiran</h2>
            <select
              value={chartRange}
              onChange={(e) => setChartRange(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}
            >
              <option value="daily" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text)' }}>Hari Ini</option>
              <option value="7_days" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text)' }}>7 Hari Terakhir</option>
              <option value="monthly" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text)' }}>6 Bulan Terakhir</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>Hadir</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>Terlambat</span>
            </div>
          </div>

          <div style={{ height: '380px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '100%' }}>
                {[...Array(7)].map((_, i) => (
                  <div key={i} style={{ flex: 1, height: `${30 + ((i * 17) % 60)}%`, background: 'var(--color-bg-base)', borderRadius: '6px' }} className="animate-pulse" />
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 15, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontWeight: 500 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontWeight: 500 }} dx={-10} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid var(--color-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', background: 'var(--color-bg-surface)', padding: '10px 14px' }}
                    labelStyle={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px', fontSize: '13px' }}
                  />
                  <Area type="monotone" dataKey="terlambat" name="Terlambat" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLate)" dot={{ r: 3, strokeWidth: 1.5, fill: '#fff' }} activeDot={{ r: 5, fill: '#f59e0b', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="hadir" name="Hadir" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHadir)" dot={{ r: 3, strokeWidth: 1.5, fill: '#fff' }} activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ marginTop: '10px', background: trendBg, borderRadius: '10px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <TrendIcon color={trendIconColor} size={16} />
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: trendTextColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {trendMessage}
            </span>
          </div>
        </div>

      </div>

    </div>
  )
}

