import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserCheck, Clock, TrendingUp, TrendingDown,
  UserPlus, Download, ArrowRight, Activity
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import dashboardApi from '../services/dashboardApi'
import userApi from '../services/userApi'
import api from '@shared/services/api'
import useWebSocket from '@shared/hooks/useWebSocket'
import { useAuthStore } from '@shared/store/authStore'



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
          stroke="rgba(99, 102, 241, 0.12)"
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
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" />
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
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{percentage}%</span>
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
  },
  {
    key: 'present',
    label: 'Hadir Hari Ini',
    icon: UserCheck,
    iconBg: 'rgba(16, 185, 129, 0.1)',
    iconColor: '#10b981',
  },
  {
    key: 'late',
    label: 'Terlambat Hari Ini',
    icon: Clock,
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconColor: '#f59e0b',
  },
]

// Day labels for chart
const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default function DashboardPage() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, absent: 0 })
  const [weeklyStats, setWeeklyStats] = useState([])
  const [monthlyStats, setMonthlyStats] = useState([])
  const [chartRange, setChartRange] = useState('7_days')
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState([])

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, weeklyRes, monthlyRes, usersRes, eventsRes] = await Promise.allSettled([
        dashboardApi.getStats(),
        dashboardApi.getWeekly(),
        dashboardApi.getMonthly(),
        userApi.list({ limit: 1, status: 'aktif' }),
        api.get('/api/v1/dashboard/activities', { params: { limit: 5 } })
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
      if (monthlyRes.status === 'fulfilled') {
        setMonthlyStats(monthlyRes.value.data)
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

  // Prepare chart data
  const activeStats = chartRange === 'monthly' ? monthlyStats : weeklyStats
  const chartData = activeStats.length > 0
    ? activeStats.map((d, i) => {
        if (chartRange === 'monthly') {
          return {
            day: d.day, // "Jan", "Feb", etc.
            fullDay: d.full_name || d.day, // "Jan 2026"
            hadir: d.present || 0,
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
        
        let idDay = shortDayMap[enDay] || enDay || dayLabels[i] || `H-${i+1}`
        if (!idDay) idDay = d.day
        
        return {
          day: idDay,
          fullDay: dayMap[enDay] ? `${dayMap[enDay]}, ${formattedDate}` : d.day,
          hadir: d.present || 0,
          terlambat: d.late || 0
        }
      })
    : dayLabels.map((day) => ({ day, hadir: 0, terlambat: 0 }))

  // Display activities (strictly real data from API/WS + demo mock)
  const displayActivities = activities.map((act) => {
    const isLate = act.late
    const isCheckIn = act.event_type === 'IN'
    const isExport = act.event_type === 'EXPORT'
    const isRegister = act.event_type === 'REGISTER'
    const isDelete = act.event_type === 'DELETE'
    
    let actionText = 'Berhasil melakukan presensi pulang'
    let statusText = 'Pulang'
    let sColor = '#4f46e5'
    let sBg = '#e0e7ff'
    
    if (isCheckIn) {
      actionText = 'Berhasil melakukan presensi masuk'
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
      time: act.timestamp
        ? new Date(act.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '-',
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
      trendBg = "rgba(16, 185, 129, 0.05)"
      trendTextColor = "#065f46"
    } else if (todayData.hadir < yesterdayData.hadir) {
      trendMessage = `Tingkat kehadiran hari ini (${todayData.hadir}) lebih rendah dibandingkan kemarin (${yesterdayData.hadir}).`
      TrendIcon = TrendingDown
      trendIconColor = "#ef4444"
      trendBg = "rgba(239, 68, 68, 0.05)"
      trendTextColor = "#991b1b"
    } else {
      trendMessage = `Tingkat kehadiran hari ini sama persis dengan hari kemarin (${todayData.hadir} orang).`
      TrendIcon = TrendingUp
      trendIconColor = "#3b82f6"
      trendBg = "rgba(59, 130, 246, 0.05)"
      trendTextColor = "#1e40af"
    }
  }

  // Mock trend data logic
  const getTrendData = (key) => {
    if (key === 'total') return { value: '↑ 2 dari minggu lalu', color: '#10b981' }
    if (key === 'present') return { value: '↑ 5 dari kemarin', color: '#10b981' }
    if (key === 'late') return { value: '↓ 1 dari kemarin', color: '#10b981' }
    if (key === 'rate') return { value: '↑ 3% dari kemarin', color: '#10b981' }
    return { value: '↑ 3% dari kemarin', color: '#10b981' }
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in dashboard-main">
      


      {/* 2. QUICK ACCESS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
        {[
          { label: 'Export Laporan', desc: 'Export data absensi dan laporan kehadiran', icon: Download, color: '#4f46e5', bg: '#e0e7ff', path: '/admin/attendance' },
          { label: 'Tambah Pengguna', desc: 'Tambah pengguna baru ke sistem', icon: UserPlus, color: '#10b981', bg: '#d1fae5', path: '/admin/users' },
        ].map((action, idx) => (
          <div
            key={idx}
            onClick={() => navigate(action.path)}
            className="hover-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              padding: '24px 32px',
              borderRadius: '20px',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: action.bg, color: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <action.icon size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: 0, marginBottom: '4px' }}>{action.label}</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{action.desc}</p>
              </div>
            </div>
            <ArrowRight color="var(--color-text-secondary)" size={24} />
          </div>
        ))}
      </div>

      {/* 3. KPI CARDS */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '16px' }}>Ringkasan Hari Ini</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          
          {/* Loop for the first 3 simple stats */}
          {statCards.map(({ key, label, icon: Icon, iconBg, iconColor }) => {
            const trend = getTrendData(key)
            return (
              <div
                key={key}
                className="hover-card"
                style={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '20px',
                  padding: '24px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  display: 'flex',
                  gap: '20px',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={26} strokeWidth={2.5} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600, margin: 0, marginBottom: '6px' }}>{label}</p>
                  {loading ? (
                    <div style={{ height: '36px', width: '60px', background: 'var(--color-bg-base)', borderRadius: '6px', marginBottom: '8px' }} className="animate-pulse" />
                  ) : (
                    <p style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1, marginBottom: '8px' }}>
                      {stats[key]}
                    </p>
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: trend.color }}>
                    {trend.value}
                  </span>
                </div>
              </div>
            )
          })}
          
          {/* Attendance Donut Card */}
          <div
            className="hover-card"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              display: 'flex',
              gap: '20px',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Activity size={26} strokeWidth={2.5} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600, margin: 0, marginBottom: '6px' }}>Tingkat Kehadiran</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1 }}>
                  {attendanceRate}%
                </p>
                <AttendanceDonut percentage={attendanceRate} size={48} strokeWidth={4} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                {getTrendData('rate').value}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 4. CHARTS & ACTIVITY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px' }}>
        
        {/* Analytics Chart */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '24px', padding: '32px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Statistik Kehadiran</h2>
            <select 
              value={chartRange}
              onChange={(e) => setChartRange(e.target.value)}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}
            >
              <option value="7_days">7 Hari Terakhir</option>
              <option value="monthly">6 Bulan Terakhir</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', paddingLeft: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Hadir</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Terlambat</span>
            </div>
          </div>

          {loading ? (
             <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '300px' }}>
               {[...Array(7)].map((_, i) => (
                 <div key={i} style={{ flex: 1, height: `${30 + ((i * 17) % 60)}%`, background: 'var(--color-bg-base)', borderRadius: '8px' }} className="animate-pulse" />
               ))}
             </div>
          ) : (
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontWeight: 500 }} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontWeight: 500 }} dx={-15} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', background: 'var(--color-bg-surface)', padding: '16px' }}
                    labelStyle={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px', fontSize: '14px' }}
                  />
                  <Area type="monotone" dataKey="hadir" name="Hadir" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorHadir)" dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, fill: '#10b981', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="terlambat" name="Terlambat" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorLate)" dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, fill: '#f59e0b', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ marginTop: '24px', background: trendBg, borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendIcon color={trendIconColor} size={20} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: trendTextColor }}>
              {trendMessage}
            </span>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div style={{ flex: '1', minWidth: '340px', background: 'var(--color-bg-surface)', borderRadius: '24px', padding: '32px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>Aktivitas Terbaru</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {displayActivities.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '14px', padding: '40px 0' }}>Belum ada aktivitas.</div>
            ) : (
              displayActivities.map((act, i) => (
                <div key={act.id || i} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1, alignItems: 'center' }}>
                  {/* Avatar Bubble */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', background: act.avatarBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: act.avatarColor, fontSize: '16px', fontWeight: 700, flexShrink: 0
                  }}>
                    {act.user_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  
                  {/* Content */}
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text)', margin: 0, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {act.user_name}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {act.action}
                      </p>
                    </div>
                    
                    <div style={{ padding: '4px 12px', borderRadius: '6px', background: act.statusBg, color: act.statusColor, fontSize: '11px', fontWeight: 600 }}>
                      {act.status}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Lihat Semua Button at the bottom, plain text */}
          <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: '24px' }}>
            <button
              onClick={() => navigate('/admin/attendance')}
              style={{ 
                background: 'transparent', border: 'none', padding: '8px 16px', fontSize: '14px', 
                fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            >
              Lihat Semua Aktivitas →
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
