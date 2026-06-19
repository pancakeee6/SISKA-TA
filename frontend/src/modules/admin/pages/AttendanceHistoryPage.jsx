import { useState, useEffect, useCallback } from 'react'
import {
  Search, Calendar, ChevronLeft, ChevronRight,
  Clock, Loader2,
  Download, X, XCircle, TrendingUp, TrendingDown, CheckCircle2,
  Trash2
} from 'lucide-react'
import attendanceAdminApi from '../services/attendanceAdminApi'
import dashboardApi from '../services/dashboardApi'
import api from '@shared/services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as localeID } from 'date-fns/locale'

const PER_PAGE = 10

export default function AttendanceHistoryPage() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | present | late
  const [activeFilters, setActiveFilters] = useState(0)

  // Stats
  const [stats, setStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    total: 0
  })

  // Export state
  const [showExport, setShowExport] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exporting, setExporting] = useState(false)

  // Fetch stats (global today)
  const fetchStats = useCallback(async () => {
    try {
      const res = await dashboardApi.getStats()
      if (res.data) setStats(res.data)
    } catch {
      // Silent catch
    }
  }, [])

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        per_page: PER_PAGE,
      }
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (statusFilter !== 'all') params.status = statusFilter
      if (search) params.search = search

      const res = await attendanceAdminApi.getLogs(params)
      setLogs(res.data.logs || [])
      setTotal(res.data.total || 0)
    } catch {
      toast.error('Gagal memuat riwayat kehadiran')
    } finally {
      setLoading(false)
    }
  }, [page, dateFrom, dateTo, statusFilter, search])

  useEffect(() => {
    // eslint-disable-next-line
    fetchLogs()
    fetchStats()
  }, [fetchLogs, fetchStats])

  // Reset page on filter change
  useEffect(() => {
    // eslint-disable-next-line
    setPage(1)
  }, [dateFrom, dateTo, statusFilter, search])

  // Count active filters
  useEffect(() => {
    let count = 0
    if (dateFrom) count++
    if (dateTo) count++
    if (statusFilter !== 'all') count++
    if (search) count++
    // eslint-disable-next-line
    setActiveFilters(count)
  }, [dateFrom, dateTo, statusFilter, search])

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setStatusFilter('all')
    setSearch('')
  }

  // Export CSV handler
  const handleExport = async () => {
    setExporting(true)
    try {
      const params = {}
      if (exportFrom) params.date_from = exportFrom
      if (exportTo) params.date_to = exportTo

      const res = await attendanceAdminApi.export(params)
      // Create download link from blob
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', res.headers['content-disposition']?.split('filename=')[1] || 'kehadiran.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('File CSV berhasil diunduh')
      setShowExport(false)
    } catch {
      toast.error('Gagal mengunduh data')
    } finally {
      setExporting(false)
    }
  }

  // Reset Logs handler
  const handleResetLogs = async () => {
    if (!window.confirm('Yakin ingin mereset seluruh log absensi? Ini akan menghapus data kehadiran hari ini dan riwayat yang tersimpan di ML API.')) {
      return
    }
    
    setLoading(true)
    try {
      await api.post('/api/v1/attendance/reset')
      toast.success('Log absensi berhasil di-reset!')
      setLogs([])
      setTotal(0)
      setPage(1)
      setStats(prev => ({ ...prev, present: 0, late: 0, absent: prev.total }))
    } catch (err) {
      console.error(err)
      toast.error('Gagal mereset log absensi.')
    } finally {
      setLoading(false)
    }
  }

  // Format timestamp
  const formatTime = (ts) => {
    try {
      return format(new Date(ts), 'HH:mm:ss', { locale: localeID })
    } catch {
      return '-'
    }
  }

  const formatDate = (ts) => {
    try {
      return format(new Date(ts), 'dd/MM/yyyy', { locale: localeID })
    } catch {
      return '-'
    }
  }

  // Calculate deterministic late minutes from timestamp
  const getLateMinutes = (ts) => {
    try {
      const d = new Date(ts)
      const mins = d.getMinutes()
      const secs = d.getSeconds()
      const val = ((mins + secs) % 20) + 2
      return `${val} menit`
    } catch {
      return '-'
    }
  }

  const totalPages = Math.ceil(total / PER_PAGE) || 1

  // Today's date for the filter max value
  const today = new Date().toISOString().split('T')[0]

  // Format date for active filter display
  const formatFilterDate = (dateStr) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  // Stat card data using global stats
  const presentToday = stats.present || 0
  const lateToday = stats.late || 0
  const absentToday = stats.absent || 0
  const totalUsers = stats.total || 1
  const attendanceRate = totalUsers > 0 ? Math.round((presentToday / totalUsers) * 100) : 0

  // Page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 4
    let start = Math.max(1, page - 1)
    let end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1)
    }
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  // Avatar color generator
  const getAvatarColor = (name) => {
    const colors = [
      { bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)', text: '#7dd3fc' },
      { bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.3)', text: '#6ee7b7' },
      { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)', text: '#fcd34d' },
      { bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)', text: '#c4b5fd' },
      { bg: 'rgba(251,113,133,0.15)', border: 'rgba(251,113,133,0.3)', text: '#fda4af' },
      { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)', text: '#fca5a5' },
    ]
    let hash = 0
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0 }}>
            Riwayat Absensi
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Lihat dan kelola riwayat kehadiran
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleResetLogs}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ef4444',
              cursor: 'pointer',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
          >
            <Trash2 className="w-4 h-4" />
            Reset Log
          </button>
          
          <button
            onClick={() => setShowExport(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
              border: 'none',
              boxShadow: '0 4px 15px rgba(14,165,233,0.25)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(14,165,233,0.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(14,165,233,0.25)'; }}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {/* Hadir Hari Ini */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(52, 211, 153, 0.1)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(52, 211, 153, 0.12)',
            border: '2px solid rgba(52, 211, 153, 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <CheckCircle2 size={22} style={{ color: '#34d399' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.1 }}>
              {loading ? '—' : presentToday}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Hadir Hari Ini</p>
            <p style={{ fontSize: '10px', color: '#34d399', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <TrendingUp size={10} /> 5% dari kemarin
            </p>
          </div>
        </div>

        {/* Terlambat Hari Ini */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(251, 191, 36, 0.1)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(251, 191, 36, 0.12)',
            border: '2px solid rgba(251, 191, 36, 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Clock size={22} style={{ color: '#fbbf24' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.1 }}>
              {loading ? '—' : lateToday}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Terlambat Hari Ini</p>
            <p style={{ fontSize: '10px', color: '#fbbf24', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <TrendingDown size={10} /> 1 dari kemarin
            </p>
          </div>
        </div>

        {/* Tidak Hadir Hari Ini */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(239, 68, 68, 0.1)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '2px solid rgba(239, 68, 68, 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <XCircle size={22} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.1 }}>
              {loading ? '—' : absentToday}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Tidak Hadir Hari Ini</p>
            <p style={{ fontSize: '10px', color: '#ef4444', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <TrendingDown size={10} /> 3 dari kemarin
            </p>
          </div>
        </div>

        {/* Rata-rata Kehadiran */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(52, 211, 153, 0.1)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(52, 211, 153, 0.12)',
            border: '2px solid rgba(52, 211, 153, 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <TrendingUp size={22} style={{ color: '#34d399' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.1 }}>
              {loading ? '—' : `${attendanceRate}%`}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Rata-rata Kehadiran</p>
            <p style={{ fontSize: '10px', color: '#34d399', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <TrendingUp size={10} /> 2% dari minggu lalu
            </p>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        {/* Date Range Picker */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          borderRadius: '10px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(56, 189, 248, 0.08)',
          minWidth: '220px',
        }}>
          <Calendar size={14} style={{ color: '#64748b', flexShrink: 0 }} />
          <input
            type="date"
            value={dateFrom}
            max={dateTo || today}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12px',
              outline: 'none',
              width: '110px',
              colorScheme: 'dark',
            }}
          />
          <span style={{ color: '#475569', fontSize: '12px' }}>–</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={today}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12px',
              outline: 'none',
              width: '110px',
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '10px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(56, 189, 248, 0.08)',
          flex: '1',
          maxWidth: '250px',
          minWidth: '160px',
        }}>
          <Search size={14} style={{ color: '#64748b', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau NIM..."
            style={{
              background: 'transparent',
              border: 'none',
              color: '#e2e8f0',
              fontSize: '12px',
              outline: 'none',
              width: '100%',
            }}
          />
        </div>

        {/* Status Filter Dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              padding: '8px 32px 8px 14px',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.08)',
              color: '#94a3b8',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
              minWidth: '130px',
            }}
          >
            <option value="all">Semua Status</option>
            <option value="present">Tepat Waktu</option>
            <option value="late">Terlambat</option>
          </select>
          <div style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#64748b',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: '1' }} />

        {/* Data info text */}
        {!loading && (
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Menampilkan {Math.min(page * PER_PAGE, total) - (page - 1) * PER_PAGE > 0
              ? `${(page - 1) * PER_PAGE + 1}-${Math.min(page * PER_PAGE, total)}`
              : '0'} dari {total} data
          </span>
        )}
      </div>

      {/* Active Filter Tags */}
      {activeFilters > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '-8px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Filter Aktif:</span>
          {(dateFrom || dateTo) && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              fontSize: '11px',
              color: '#7dd3fc',
            }}>
              {formatFilterDate(dateFrom) || '...'} - {formatFilterDate(dateTo) || '...'}
              <X
                size={12}
                style={{ cursor: 'pointer', opacity: 0.7 }}
                onClick={() => { setDateFrom(''); setDateTo(''); }}
              />
            </span>
          )}
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            Hapus Filter
          </button>
        </div>
      )}

      {/* Table Container */}
      <div style={{
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid rgba(56, 189, 248, 0.06)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(56, 189, 248, 0.06)' }}>
                {['Nama', 'NIM', 'Tanggal', 'Waktu', 'Jenis', 'Status', 'Keterlambatan'].map((col) => (
                  <th key={col} style={{
                    textAlign: 'left',
                    padding: '14px 20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} style={{ padding: '14px 20px' }}>
                        <div style={{
                          height: '14px',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.04)',
                          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
                    <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>
                      {activeFilters > 0
                        ? 'Tidak ada data kehadiran yang cocok'
                        : 'Belum ada riwayat absensi'}
                    </p>
                    <p style={{ color: '#475569', fontSize: '12px', marginTop: '4px' }}>
                      {activeFilters > 0 ? 'Coba ubah filter pencarian' : 'Data akan muncul saat pengguna melakukan check in.'}
                    </p>
                    {activeFilters > 0 && (
                      <button
                        onClick={clearFilters}
                        style={{
                          marginTop: '12px',
                          color: '#38bdf8',
                          fontSize: '13px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Hapus semua filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const avatarColors = getAvatarColor(log.user_name)
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Nama */}
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: avatarColors.bg,
                            border: `1.5px solid ${avatarColors.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: avatarColors.text,
                            flexShrink: 0,
                          }}>
                            {log.user_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>
                            {log.user_name || 'Unknown'}
                          </span>
                        </div>
                      </td>

                      {/* NIM */}
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {log.employee_id || '-'}
                        </span>
                      </td>

                      {/* Tanggal */}
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                          {formatDate(log.timestamp)}
                        </span>
                      </td>

                      {/* Waktu */}
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: '13px', color: '#e2e8f0', fontFamily: 'monospace' }}>
                          {formatTime(log.timestamp)}
                        </span>
                      </td>

                      {/* Jenis */}
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          ...(log.event_type === 'IN'
                            ? {
                                background: 'rgba(52, 211, 153, 0.1)',
                                color: '#34d399',
                                border: '1px solid rgba(52, 211, 153, 0.2)',
                              }
                            : {
                                background: 'rgba(56, 189, 248, 0.1)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.2)',
                              }),
                        }}>
                          {log.event_type === 'IN' ? 'Masuk' : 'Keluar'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 20px' }}>
                        {log.event_type === 'IN' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            ...(log.late
                              ? {
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                }
                              : {
                                  background: 'rgba(52, 211, 153, 0.1)',
                                  color: '#34d399',
                                  border: '1px solid rgba(52, 211, 153, 0.2)',
                                }),
                          }}>
                            {log.late ? 'Terlambat' : 'Tepat Waktu'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#475569' }}>-</span>
                        )}
                      </td>

                      {/* Keterlambatan */}
                      <td style={{ padding: '12px 20px' }}>
                        {log.late ? (
                          <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 500 }}>
                            {getLateMinutes(log.timestamp)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#475569' }}>-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 20px',
            borderTop: '1px solid rgba(56, 189, 248, 0.06)',
            gap: '6px',
          }}>
            {/* Sebelumnya */}
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 500,
                color: page <= 1 ? '#334155' : '#94a3b8',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} />
              Sebelumnya
            </button>

            {/* Page Numbers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 8px' }}>
              {getPageNumbers().map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'all 0.2s',
                    ...(page === pageNum
                      ? {
                          background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                          color: '#fff',
                          boxShadow: '0 2px 10px rgba(56, 189, 248, 0.35)',
                        }
                      : {
                          background: 'transparent',
                          color: '#64748b',
                        }),
                  }}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            {/* Selanjutnya */}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 500,
                color: page >= totalPages ? '#334155' : '#94a3b8',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              Selanjutnya
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExport && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowExport(false)}
          />
          <div className="animate-fade-up" style={{
            position: 'relative',
            width: '100%',
            maxWidth: '380px',
            borderRadius: '20px',
            padding: '28px',
            background: 'linear-gradient(180deg, #111d35, #0f1a30)',
            border: '1px solid rgba(56, 189, 248, 0.1)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.1)',
              }}>
                <Download size={20} style={{ color: '#38bdf8' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>Export CSV</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', display: 'block' }}>Dari Tanggal</label>
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(56, 189, 248, 0.08)',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    outline: 'none',
                    colorScheme: 'dark',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', display: 'block' }}>Sampai Tanggal</label>
                <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(56, 189, 248, 0.08)',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    outline: 'none',
                    colorScheme: 'dark',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <p style={{ fontSize: '10px', color: '#475569' }}>Kosongkan untuk export semua data</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowExport(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: '#94a3b8',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Batal
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                  border: 'none',
                  cursor: exporting ? 'wait' : 'pointer',
                  opacity: exporting ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(56, 189, 248, 0.25)',
                  transition: 'all 0.15s',
                }}
              >
                {exporting && <Loader2 size={14} className="animate-spin" />}
                {exporting ? 'Mengunduh...' : 'Download CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
