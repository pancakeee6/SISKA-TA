import { useState, useEffect } from 'react'
import { Users, UserCheck, Clock, UserX, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import dashboardApi from '../services/dashboardApi'
import userApi from '../services/userApi'

const statCards = [
  {
    key: 'total',
    label: 'Total Karyawan',
    icon: Users,
    gradient: 'from-blue-500 to-cyan-500',
    bgGlow: 'shadow-blue-500/20',
  },
  {
    key: 'present',
    label: 'Hadir Hari Ini',
    icon: UserCheck,
    gradient: 'from-emerald-500 to-green-500',
    bgGlow: 'shadow-emerald-500/20',
  },
  {
    key: 'late',
    label: 'Terlambat',
    icon: Clock,
    gradient: 'from-amber-500 to-orange-500',
    bgGlow: 'shadow-amber-500/20',
  },
  {
    key: 'absent',
    label: 'Belum Absen',
    icon: UserX,
    gradient: 'from-rose-500 to-pink-500',
    bgGlow: 'shadow-rose-500/20',
  },
]

export default function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, absent: 0 })
  const [weeklyStats, setWeeklyStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [statsRes, weeklyRes, usersRes] = await Promise.allSettled([
        dashboardApi.getStats(),
        dashboardApi.getWeekly(),
        userApi.list({ limit: 1 }),
      ])

      if (statsRes.status === 'fulfilled') {
        const statsData = statsRes.value.data
        // Also get total users count
        const totalUsers = usersRes.status === 'fulfilled'
          ? (usersRes.value.data.total || usersRes.value.data.items?.length || 0)
          : 0
        setStats({ ...statsData, total: totalUsers })
      }
      if (weeklyRes.status === 'fulfilled') {
        setWeeklyStats(weeklyRes.value.data)
      }
    } catch {
      // Silently fail — show zeros
    } finally {
      setLoading(false)
    }
  }

  // Simple percentage calculation for bar chart
  const maxWeeklyValue = Math.max(
    ...weeklyStats.map((d) => (d.present || 0) + (d.late || 0) + (d.absent || 0)),
    1
  )

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Ringkasan kehadiran hari ini — {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ key, label, icon: Icon, gradient, bgGlow }) => (
          <div
            key={key}
            className={`relative group bg-[#1a1d2e] rounded-2xl p-5 border border-white/[0.06]
                       hover:border-white/[0.1] transition-all duration-300 overflow-hidden
                       shadow-lg ${bgGlow}`}
          >
            {/* Background gradient glow */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.03] group-hover:opacity-[0.06] transition-opacity`} />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">{label}</p>
                {loading ? (
                  <div className="h-9 w-16 bg-white/[0.05] rounded-lg animate-pulse" />
                ) : (
                  <p className="text-3xl font-bold text-white">{stats[key]}</p>
                )}
              </div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Trend indicator (mock for now) */}
            <div className="relative flex items-center gap-1 mt-3">
              {key === 'present' ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400">Bagus</span>
                </>
              ) : key === 'absent' && stats.absent > 0 ? (
                <>
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-xs text-rose-400">{stats.absent} belum</span>
                </>
              ) : (
                <span className="text-xs text-slate-500">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section: Weekly Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Weekly Chart */}
        <div className="lg:col-span-3 bg-[#1a1d2e] rounded-2xl border border-white/[0.06] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Statistik Mingguan</h2>
              <p className="text-xs text-slate-500 mt-0.5">7 hari terakhir</p>
            </div>
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-8 bg-white/[0.03] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : weeklyStats.length > 0 ? (
            <div className="space-y-3">
              {weeklyStats.map((day, i) => {
                const total = (day.present || 0) + (day.late || 0) + (day.absent || 0)
                const presentPct = total > 0 ? ((day.present || 0) / maxWeeklyValue) * 100 : 0
                const latePct = total > 0 ? ((day.late || 0) / maxWeeklyValue) * 100 : 0

                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-10 shrink-0">{day.day || `Day ${i + 1}`}</span>
                    <div className="flex-1 h-7 bg-white/[0.03] rounded-lg overflow-hidden flex">
                      {presentPct > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-l-lg transition-all duration-500"
                          style={{ width: `${presentPct}%` }}
                        />
                      )}
                      {latePct > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                          style={{ width: `${latePct}%` }}
                        />
                      )}
                    </div>
                    <span className="text-xs text-slate-500 w-8 text-right">{total}</span>
                  </div>
                )
              })}

              {/* Legend */}
              <div className="flex items-center gap-4 pt-2 border-t border-white/[0.04] mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-400">Hadir</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-slate-400">Terlambat</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Activity className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Belum ada data minggu ini</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-[#1a1d2e] rounded-2xl border border-white/[0.06] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Aktivitas Terkini</h2>
              <p className="text-xs text-slate-500 mt-0.5">Kehadiran real-time</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mb-3">
              <UserCheck className="w-5 h-5 opacity-30" />
            </div>
            <p className="text-sm text-center">Belum ada aktivitas</p>
            <p className="text-xs text-slate-600 mt-1">Data akan muncul saat karyawan absen</p>
          </div>
        </div>
      </div>
    </div>
  )
}
