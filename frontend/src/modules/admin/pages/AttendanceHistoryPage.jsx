import { useState, useEffect, useCallback } from 'react'
import {
  Search, Calendar, ChevronLeft, ChevronRight,
  Clock, Loader2, ClipboardList,
  Download, X, XCircle, TrendingUp, TrendingDown, CheckCircle2,
  Trash2, Briefcase
} from 'lucide-react'
import attendanceAdminApi from '../services/attendanceAdminApi'
import dashboardApi from '../services/dashboardApi'
import userApi from '../services/userApi'
import api from '@shared/services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as localeID } from 'date-fns/locale'

const PER_PAGE = 10

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
    if (log.status === 'dinas' || log.event_type === 'DINAS') {
      normalizedMap.set(log.id || Math.random(), {
        ...log,
        event_type: 'DINAS',
        shift_label: log.device_id || 'Dinas Luar Kota'
      });
      resultIds.push(log.id || Math.random());
      return;
    }
    const dt = new Date(log.timestamp);
    if (isNaN(dt.getTime())) {
      normalizedMap.set(log.id || Math.random(), log);
      return;
    }
    
    const dateStr = log.timestamp.split('T')[0];
    const hour = dt.getHours() + (dt.getMinutes() / 60);
    
    const shiftLabel = hour < 15 ? 'Shift 1' : 'Shift 2';
    const userId = log.user_name || log.user_id || log.employee_id || log.full_name || 'unknown';
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
    dinas: 0,
    absent: 0,
    total: 0
  })

  // Dinas modal state
  const [showDinasModal, setShowDinasModal] = useState(false)
  const [userList, setUserList] = useState([])
  const [dinasForm, setDinasForm] = useState({
    user_id: '',
    date: new Date().toISOString().split('T')[0],
    keterangan: 'Dinas Luar Kota'
  })
  const [submittingDinas, setSubmittingDinas] = useState(false)

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
      setLogs(normalizeAttendanceLogs(res.data.logs || []))
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
    if (window.location.search.includes('action=dinas')) {
      openDinasModal()
    }
  }, [fetchLogs, fetchStats])

  const openDinasModal = async () => {
    setShowDinasModal(true)
    try {
      const res = await userApi.list({ status: 'aktif', limit: 100 })
      const list = res.data?.items || res.data?.users || (Array.isArray(res.data) ? res.data : [])
      setUserList(list)
    } catch {
      toast.error('Gagal memuat daftar pegawai')
    }
  }

  const handleRecordDinas = async (e) => {
    e.preventDefault()
    if (!dinasForm.user_id) {
      toast.error('Pilih pegawai/dosen terlebih dahulu')
      return
    }
    setSubmittingDinas(true)
    try {
      let finalDate = dinasForm.date
      if (finalDate && finalDate.includes('/')) {
        const parts = finalDate.split('/')
        if (parts.length === 3) {
          finalDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
        }
      }
      await attendanceAdminApi.recordDinas({ ...dinasForm, date: finalDate })
      toast.success('Status Dinas Luar Kota berhasil dicatat!')
      setShowDinasModal(false)
      fetchLogs()
      fetchStats()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mencatat dinas luar kota')
    } finally {
      setSubmittingDinas(false)
    }
  }

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
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
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

  // Calculate real late duration from shift or exact timestamp
  const formatLateDuration = (log) => {
    if (log && log.late_duration && log.late_duration !== '-') {
      return log.late_duration
    }
    if (log && typeof log.late_minutes === 'number' && log.late_minutes >= 0) {
      const hours = Math.floor(log.late_minutes / 60)
      const mins = log.late_minutes % 60
      if (hours > 0 && mins > 0) return `${hours} jam ${mins} menit`
      if (hours > 0) return `${hours} jam`
      return `${mins || 1} menit`
    }
    try {
      const ts = log && log.timestamp ? log.timestamp : log
      const d = new Date(ts)
      const hour = d.getHours()
      const min = d.getMinutes()
      let shiftHour = 8
      if (hour >= 15) {
        shiftHour = 15
      }
      const diffMins = Math.max(1, (hour - shiftHour) * 60 + min)
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      if (hours > 0 && mins > 0) return `${hours} jam ${mins} menit`
      if (hours > 0) return `${hours} jam`
      return `${mins} menit`
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
  const dinasToday = stats.dinas || 0
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
      { bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.3)', text: 'var(--color-text)' },
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
      <div style={{ 
        background: 'var(--color-bg-surface)', 
        border: '1px solid var(--color-border)', 
        borderRadius: '24px', 
        padding: '24px 28px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '16px',
            background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ClipboardList size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
              Riwayat Absensi
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              Lihat, filter, dan kelola seluruh catatan kehadiran pegawai
            </p>
          </div>
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
              color: '#dc2626',
              cursor: 'pointer',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
          >
            <Trash2 className="w-4 h-4" />
            Reset Log
          </button>

          <button
            onClick={openDinasModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#4f46e5',
              cursor: 'pointer',
              background: '#e0e7ff',
              border: '1px solid #c7d2fe',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#c7d2fe'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#e0e7ff'; }}
          >
            <Briefcase size={16} />
            Catat Dinas Luar
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
              background: '#2563eb',
              border: 'none',
              boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px' }}>
        {/* Hadir Hari Ini */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: '#d1fae5',
            border: '2px solid #a7f3d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <CheckCircle2 size={22} style={{ color: '#059669' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.1 }}>
              {loading ? '—' : presentToday}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>Hadir Hari Ini</p>
            <p style={{ fontSize: '10px', color: '#059669', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <TrendingUp size={10} /> 5% dari kemarin
            </p>
          </div>
        </div>

        {/* Terlambat Hari Ini */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: '#fef3c7',
            border: '2px solid #fde68a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Clock size={22} style={{ color: '#d97706' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.1 }}>
              {loading ? '—' : lateToday}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>Terlambat Hari Ini</p>
            <p style={{ fontSize: '10px', color: '#d97706', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <TrendingDown size={10} /> 1 dari kemarin
            </p>
          </div>
        </div>

        {/* Dinas Luar Kota Hari Ini */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: '#e0e7ff',
            border: '2px solid #c7d2fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Briefcase size={22} style={{ color: '#4f46e5' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.1 }}>
              {loading ? '—' : dinasToday}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>Dinas Luar Kota</p>
            <p style={{ fontSize: '10px', color: '#4f46e5', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <TrendingUp size={10} /> Izin resmi dosen
            </p>
          </div>
        </div>

        {/* Tidak Hadir Hari Ini */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: '#fee2e2',
            border: '2px solid #fecaca',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <XCircle size={22} style={{ color: '#dc2626' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.1 }}>
              {loading ? '—' : absentToday}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>Tidak Hadir Hari Ini</p>
            <p style={{ fontSize: '10px', color: '#dc2626', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <TrendingDown size={10} /> 3 dari kemarin
            </p>
          </div>
        </div>

        {/* Rata-rata Kehadiran */}
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: '#d1fae5',
            border: '2px solid #a7f3d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <TrendingUp size={22} style={{ color: '#059669' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.1 }}>
              {loading ? '—' : `${attendanceRate}%`}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>Rata-rata Kehadiran</p>
            <p style={{ fontSize: '10px', color: '#059669', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
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
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          minWidth: '220px',
        }}>
          <Calendar size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <input
            type="date"
            value={dateFrom}
            max={dateTo || today}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: '12px',
              outline: 'none',
              width: '110px',
            }}
          />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>–</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={today}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: '12px',
              outline: 'none',
              width: '110px',
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
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          flex: '1',
          maxWidth: '250px',
          minWidth: '160px',
        }}>
          <Search size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau NIM..."
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text)',
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
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              color: 'var(--color-text)',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
              minWidth: '130px',
            }}
          >
            <option value="all">Semua Status</option>
            <option value="present">Tepat Waktu</option>
            <option value="late">Terlambat</option>
            <option value="dinas">Dinas Luar Kota</option>
          </select>
          <div style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--color-text-secondary)',
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
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            Menampilkan {Math.min(page * PER_PAGE, total) - (page - 1) * PER_PAGE > 0
              ? `${(page - 1) * PER_PAGE + 1}-${Math.min(page * PER_PAGE, total)}`
              : '0'} dari {total} data
          </span>
        )}
      </div>

      {/* Active Filter Tags */}
      {activeFilters > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '-8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Filter Aktif:</span>
          {(dateFrom || dateTo) && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '8px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              fontSize: '11px',
              color: '#2563eb',
              fontWeight: 500,
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
              color: '#dc2626',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
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
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-base)' }}>
                {['Nama', 'NIM', 'Tanggal', 'Waktu', 'Jenis', 'Status', 'Keterangan / Info'].map((col) => (
                  <th key={col} style={{
                    textAlign: 'left',
                    padding: '14px 20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
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
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} style={{ padding: '14px 20px' }}>
                        <div style={{
                          height: '14px',
                          borderRadius: '6px',
                          background: '#f1f5f9',
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
                    <p style={{ color: 'var(--color-text)', fontSize: '14px', fontWeight: 600 }}>
                      {activeFilters > 0
                        ? 'Tidak ada data kehadiran yang cocok'
                        : 'Belum ada riwayat absensi'}
                    </p>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                      {activeFilters > 0 ? 'Coba ubah filter pencarian' : 'Data akan muncul saat pengguna melakukan check in.'}
                    </p>
                    {activeFilters > 0 && (
                      <button
                        onClick={clearFilters}
                        style={{
                          marginTop: '12px',
                          color: '#2563eb',
                          fontSize: '13px',
                          fontWeight: 600,
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
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-base)'; }}
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
                          <span style={{ fontSize: '13px', color: 'var(--color-text)', fontWeight: 600 }}>
                            {log.user_name || 'Unknown'}
                          </span>
                        </div>
                      </td>

                      {/* NIM */}
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                          {log.employee_id || '-'}
                        </span>
                      </td>

                      {/* Tanggal */}
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          {formatDate(log.timestamp)}
                        </span>
                      </td>

                      {/* Waktu */}
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-text)', fontFamily: 'monospace', fontWeight: 500 }}>
                          {formatTime(log.timestamp)}
                        </span>
                      </td>

                      {/* Jenis */}
                      <td style={{ padding: '12px 20px' }}>
                        {log.status === 'dinas' || log.event_type === 'DINAS' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#e0e7ff',
                            color: '#4f46e5',
                            border: '1px solid #c7d2fe',
                          }}>
                            Dinas Luar
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            ...(log.event_type === 'IN'
                              ? {
                                  background: '#d1fae5',
                                  color: '#059669',
                                  border: '1px solid #a7f3d0',
                                }
                              : {
                                  background: '#eff6ff',
                                  color: '#2563eb',
                                  border: '1px solid #bfdbfe',
                                }),
                          }}>
                            {log.event_type === 'IN' ? 'Masuk' : 'Pulang'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 20px' }}>
                        {log.status === 'dinas' || log.event_type === 'DINAS' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#e0e7ff',
                            color: '#4f46e5',
                            border: '1px solid #c7d2fe',
                          }}>
                            Izin Dinas
                          </span>
                        ) : log.event_type === 'IN' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            ...(log.late
                              ? {
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                }
                              : {
                                  background: '#d1fae5',
                                  color: '#059669',
                                  border: '1px solid #a7f3d0',
                                }),
                          }}>
                            {log.late ? 'Terlambat' : 'Tepat Waktu'}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                          }}>
                            {log.shift_label ? `Pulang (${log.shift_label})` : 'Pulang'}
                          </span>
                        )}
                      </td>

                      {/* Keterangan / Info */}
                      <td style={{ padding: '12px 20px' }}>
                        {log.status === 'dinas' || log.event_type === 'DINAS' ? (
                          <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: 600 }}>
                            {log.device_id || 'Dinas Luar Kota'}
                          </span>
                        ) : log.late ? (
                          <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                            {formatLateDuration(log)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#94a3b8' }}>-</span>
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
            borderTop: '1px solid #e2e8f0',
            background: 'var(--color-bg-surface)',
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
                color: page <= 1 ? '#cbd5e1' : 'var(--color-text-secondary)',
                background: 'var(--color-bg-base)',
                border: '1px solid var(--color-border)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: page <= 1 ? 0.6 : 1,
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
                          background: '#2563eb',
                          color: '#fff',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                        }
                      : {
                          background: 'transparent',
                          color: 'var(--color-text-secondary)',
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
                color: page >= totalPages ? '#cbd5e1' : 'var(--color-text-secondary)',
                background: 'var(--color-bg-base)',
                border: '1px solid var(--color-border)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: page >= totalPages ? 0.6 : 1,
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
              background: 'rgba(0,0,0,0.5)',
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
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                padding: '10px',
                borderRadius: '12px',
                background: '#eff6ff',
              }}>
                <Download size={20} style={{ color: '#2563eb' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Export CSV</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>Dari Tanggal</label>
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    outline: 'none',
                    colorScheme: 'light',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>Sampai Tanggal</label>
                <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    outline: 'none',
                    colorScheme: 'light',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>Kosongkan untuk export semua data</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowExport(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
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
                  background: '#2563eb',
                  border: 'none',
                  cursor: exporting ? 'wait' : 'pointer',
                  opacity: exporting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
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

      {/* Dinas Luar Kota Modal */}
      {showDinasModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '20px',
        }} className="animate-fade-in">
          <div style={{
            background: 'var(--color-bg-surface)',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '440px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Briefcase size={20} style={{ color: '#4f46e5' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Catat Dinas Luar Kota</h3>
            </div>

            <form onSubmit={handleRecordDinas} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                  Pilih Pegawai / Dosen *
                </label>
                <select
                  value={dinasForm.user_id}
                  onChange={(e) => setDinasForm({ ...dinasForm, user_id: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">-- Pilih Pegawai --</option>
                  {(Array.isArray(userList) ? userList : []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} {u.employee_id ? `(${u.employee_id})` : ''} - {u.role === 'dosen' ? 'Dosen' : 'Pegawai'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                  Tanggal Dinas (Format: HH/BB/TTTT) *
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    required
                    placeholder="HH/BB/TTTT (Contoh: 17/07/2026)"
                    value={
                      dinasForm.date && dinasForm.date.includes('-') && dinasForm.date.split('-').length === 3
                        ? `${dinasForm.date.split('-')[2]}/${dinasForm.date.split('-')[1]}/${dinasForm.date.split('-')[0]}`
                        : dinasForm.date || ''
                    }
                    onChange={(e) => {
                      const val = e.target.value
                      const parts = val.split('/')
                      if (parts.length === 3 && parts[2].length === 4) {
                        const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
                        setDinasForm({ ...dinasForm, date: isoDate })
                      } else {
                        setDinasForm({ ...dinasForm, date: val })
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--color-bg-base)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const picker = document.getElementById('dinas-calendar-picker')
                        if (picker && picker.showPicker) {
                          picker.showPicker()
                        } else if (picker) {
                          picker.click()
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--color-primary)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Calendar size={16} /> Pilih Kalender
                    </button>
                    <input
                      id="dinas-calendar-picker"
                      type="date"
                      value={
                        dinasForm.date && dinasForm.date.includes('-') && dinasForm.date.split('-').length === 3
                          ? dinasForm.date
                          : new Date().toISOString().split('T')[0]
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          setDinasForm({ ...dinasForm, date: e.target.value })
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>
                {dinasForm.date && dinasForm.date.includes('-') && dinasForm.date.split('-').length === 3 && (
                  <p style={{ fontSize: '11.5px', color: '#10b981', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ✔ Tanggal Terpilih: <strong style={{ color: 'var(--color-text)' }}>{dinasForm.date.split('-')[2]}/{dinasForm.date.split('-')[1]}/{dinasForm.date.split('-')[0]} (HH/BB/TTTT)</strong>
                  </p>
                )}
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                  Keterangan / Tujuan Dinas
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Dinas ke Jakarta / Kemendikbud"
                  value={dinasForm.keterangan}
                  onChange={(e) => setDinasForm({ ...dinasForm, keterangan: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowDinasModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingDinas}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    background: '#4f46e5',
                    border: 'none',
                    cursor: submittingDinas ? 'wait' : 'pointer',
                    opacity: submittingDinas ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                    transition: 'all 0.15s',
                  }}
                >
                  {submittingDinas && <Loader2 size={14} className="animate-spin" />}
                  {submittingDinas ? 'Menyimpan...' : 'Simpan Status Dinas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
