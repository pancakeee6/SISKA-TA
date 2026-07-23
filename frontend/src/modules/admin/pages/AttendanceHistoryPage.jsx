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

const CustomDateInput = ({ value, onChange, min, max, id, style }) => {
  const padLeft = style?.padding?.split(' ')[1] || '14px'
  return (
    <div style={{ position: 'relative', width: style?.width || 'auto' }}>
      <input
        id={id}
        type="date"
        lang="id-ID"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        style={{
          background: 'var(--color-bg-base)',
          border: '1px solid var(--color-border)',
          color: 'transparent', // Native text hidden completely
          fontSize: '13px',
          outline: 'none',
          colorScheme: 'light',
          boxSizing: 'border-box',
          ...style,
        }}
      />
      <div style={{
        position: 'absolute',
        left: '2px',
        top: '2px',
        bottom: '2px',
        width: 'calc(100% - 36px)',
        background: 'var(--color-bg-base)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: `calc(${padLeft} - 2px)`,
        borderRadius: style?.borderRadius ? `${style.borderRadius} 0 0 ${style.borderRadius}` : '8px 0 0 8px',
        color: value ? 'var(--color-text)' : 'var(--color-text-secondary)',
        fontSize: '13px',
        fontFamily: style?.fontFamily || 'inherit'
      }}>
        {value ? value.split('-').reverse().join('/') : 'HH/BB/TTTT'}
      </div>
    </div>
  )
}

const PER_PAGE = 10

// Helper untuk normalisasi event_type (Masuk & Pulang) serta deduplikasi absen per Shift:
// Shift 1: 08.00 - 15.00 (hour < 15.0)
// Shift 2: 15.00 - 21.00 (hour >= 15.0)
// Mengabaikan duplikat kamera dalam jeda singkat (< 5 menit) agar hanya absen pertama yang tersimpan/tampil sebagai Masuk,
// dan scan berikutnya di atas 5 menit dalam shift yang sama menjadi Pulang.
const normalizeAttendanceLogs = (logs) => {
  if (!logs || !Array.isArray(logs)) return [];
  
  // Pass 1: Catat shift saat absen Masuk (IN) untuk setiap user per hari
  const userInShifts = {};
  
  logs.forEach(log => {
    if (log.event_type === 'IN' && log.timestamp) {
      const dt = new Date(log.timestamp);
      if (!isNaN(dt.getTime())) {
        const dateStr = log.timestamp.split('T')[0];
        const hour = dt.getHours() + (dt.getMinutes() / 60);
        const shiftLabel = hour < 15 ? 'Shift Pagi' : 'Shift Sore';
        const userId = log.user_name || log.user_id || log.employee_id || log.full_name || 'unknown';
        userInShifts[`${userId}_${dateStr}`] = shiftLabel;
      }
    }
  });
  
  // Pass 2: Terapkan shift
  return logs.map(log => {
    if (log.status === 'dinas' || log.event_type === 'DINAS') {
      return {
        ...log,
        event_type: 'DINAS',
        shift_label: log.shift_label || 'Seharian'
      };
    }
    
    if (!log.timestamp) return log;
    
    const dt = new Date(log.timestamp);
    if (isNaN(dt.getTime())) return log;
    
    const dateStr = log.timestamp.split('T')[0];
    const userId = log.user_name || log.user_id || log.employee_id || log.full_name || 'unknown';
    
    let shiftLabel;
    
    // Jika event Pulang (OUT) dan user sudah pernah IN di hari yang sama, gunakan shift dari absen IN tersebut
    if (log.event_type === 'OUT' && userInShifts[`${userId}_${dateStr}`]) {
      shiftLabel = userInShifts[`${userId}_${dateStr}`];
    } else {
      const hour = dt.getHours() + (dt.getMinutes() / 60);
      shiftLabel = hour < 15 ? 'Shift Pagi' : 'Shift Sore';
    }
    
    // Gunakan event_type asli dari server
    return {
      ...log,
      shift_label: shiftLabel
    };
  }).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
};

export default function AttendanceHistoryPage() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const getFirstDayOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  const getLastDayOfMonth = () => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
  }

  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth())
  const [dateTo, setDateTo] = useState(getLastDayOfMonth())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | present | late
  const [shiftFilter, setShiftFilter] = useState('all')
  const [activeFilters, setActiveFilters] = useState(0)

  // Preview Modal state
  const [previewFile, setPreviewFile] = useState(null)

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
    keterangan: 'Perizinan',
    shift: 'Seharian',
    file: null
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
      if (shiftFilter !== 'all') params.shift = shiftFilter
      if (search) params.search = search

      const res = await attendanceAdminApi.getLogs(params)
      setLogs(normalizeAttendanceLogs(res.data.logs || []))
      setTotal(res.data.total || 0)
    } catch {
      toast.error('Gagal memuat riwayat kehadiran')
    } finally {
      setLoading(false)
    }
  }, [page, dateFrom, dateTo, statusFilter, shiftFilter, search])

  useEffect(() => {
    // eslint-disable-next-line
    fetchLogs()
    fetchStats()
    if (window.location.search.includes('action=dinas')) {
      openDinasModal()
    }
  }, [fetchLogs, fetchStats])

  async function openDinasModal() {
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
      
      const formData = new FormData()
      formData.append('user_id', dinasForm.user_id)
      formData.append('date', finalDate)
      formData.append('keterangan', dinasForm.keterangan || 'Perizinan')
      formData.append('shift', dinasForm.shift || 'Seharian')
      if (dinasForm.file) {
        formData.append('file', dinasForm.file)
      }

      await attendanceAdminApi.recordDinas(formData)
      toast.success('Perizinan berhasil dicatat!')
      setShowDinasModal(false)
      fetchLogs()
      fetchStats()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mencatat perizinan')
    } finally {
      setSubmittingDinas(false)
    }
  }

  // Reset page on filter change
  useEffect(() => {
    // eslint-disable-next-line
    setPage(1)
  }, [dateFrom, dateTo, statusFilter, shiftFilter, search])

  // Count active filters
  useEffect(() => {
    let count = 0
    if (dateFrom) count++
    if (dateTo) count++
    if (statusFilter !== 'all') count++
    if (shiftFilter !== 'all') count++
    if (search) count++
    // eslint-disable-next-line
    setActiveFilters(count)
  }, [dateFrom, dateTo, statusFilter, shiftFilter, search])

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setStatusFilter('all')
    setShiftFilter('all')
    setSearch('')
  }

  // Export Excel handler
  const handleExport = async () => {
    setExporting(true)
    try {
      const params = {}
      if (exportFrom) params.date_from = exportFrom
      if (exportTo) params.date_to = exportTo

      const res = await attendanceAdminApi.export(params)
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      link.href = url
      let filename = 'Laporan_Kehadiran_SISKA.xlsx'
      const disposition = res.headers['content-disposition']
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/"/g, '')
      }
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      
      setTimeout(() => {
        link.remove()
        window.URL.revokeObjectURL(url)
      }, 200)

      toast.success('Laporan Kehadiran berhasil diunduh')
      setShowExport(false)
    } catch (err) {
      console.error('Export Error:', err)
      toast.error(err.response?.data?.detail || err.message || 'Gagal mengunduh laporan')
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
      return format(new Date(ts), 'dd MMMM yyyy', { locale: localeID })
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
  const attendanceRate = totalUsers > 0 ? Math.min(100, Math.round(((presentToday + dinasToday) / totalUsers) * 100)) : 0

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
      {/* Sticky Header Wrapper */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'var(--color-bg-base)',
        margin: '-20px -24px -24px -24px',
        padding: '20px 24px 24px 24px',
      }}>
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '16px', 
          padding: '16px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: '#d1fae5', color: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ClipboardList size={24} strokeWidth={2} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
                Riwayat Absensi
              </h1>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
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
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
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
              <Trash2 size={16} strokeWidth={2.5} />
              Reset Log
            </button>
  
            <button
              onClick={openDinasModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
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
              <Briefcase size={16} strokeWidth={2.5} />
              Input Perizinan
            </button>
            
            <button
              onClick={() => setShowExport(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                background: '#2563eb',
                border: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
            >
              <Download size={16} strokeWidth={2.5} />
              Export
            </button>
          </div>
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
              {loading ? '—' : Math.max(0, presentToday - lateToday)}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>Tepat Waktu</p>
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

        {/* Perizinan Hari Ini */}
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
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>Perizinan</p>
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
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Dari:</span>
          <CustomDateInput
            value={dateFrom}
            max={today}
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
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginLeft: '4px' }}>Sampai:</span>
          <CustomDateInput
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
            placeholder="Cari nama atau NIP..."
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
            <option value="dinas">Perizinan</option>
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

        {/* Shift Filter Dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
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
            <option value="all">Semua Shift</option>
            <option value="pagi">Shift Pagi</option>
            <option value="sore">Shift Sore</option>
            <option value="seharian">Full Shift</option>
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
                {['Nama', 'NIP', 'Tanggal', 'Waktu', 'Shift', 'Jenis', 'Status', 'Keterangan'].map((col) => (
                  <th key={col} style={{
                    textAlign: col === 'Jenis' || col === 'Status' ? 'center' : 'left',
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
                    {[...Array(8)].map((_, j) => (
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
                  <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center' }}>
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

                      {/* NIP */}
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
                          {log.status === 'dinas' || log.event_type === 'DINAS' ? '-' : formatTime(log.timestamp)}
                        </span>
                      </td>

                      {/* Shift */}
                      <td style={{ padding: '12px 20px' }}>
                        {log.status === 'dinas' || log.event_type === 'DINAS' ? (
                          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                            {log.shift_label || 'Full'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                            {log.shift_label ? log.shift_label.replace('Shift ', '') : '-'}
                          </span>
                        )}
                      </td>

                      {/* Jenis */}
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        {log.status === 'dinas' || log.event_type === 'DINAS' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '70px',
                            padding: '4px 0',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#f3e8ff',
                            color: '#9333ea',
                            border: '1px solid #d8b4fe',
                          }}>
                            Izin
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '70px',
                            padding: '4px 0',
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
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        {log.status === 'dinas' || log.event_type === 'DINAS' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '90px',
                            padding: '4px 0',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#f3e8ff',
                            color: '#9333ea',
                            border: '1px solid #d8b4fe',
                          }}>
                            Izin
                          </span>
                        ) : log.event_type === 'IN' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '90px',
                            padding: '4px 0',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            ...(log.late
                              ? {
                                  background: '#ffedd5',
                                  color: '#ea580c',
                                  border: '1px solid #fdba74',
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
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '90px', fontSize: '13px', color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Info */}
                      <td style={{ padding: '12px 20px' }}>
                        {log.status === 'dinas' || log.event_type === 'DINAS' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: 600 }}>
                              {log.device_id || 'Perizinan'}
                            </span>
                            {log.attachment_path && log.attachment_path !== 'null' && log.attachment_path.trim() !== '' && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPreviewFile(log.attachment_path);
                                }}
                                style={{
                                  fontSize: '11px',
                                  color: '#2563eb',
                                  textDecoration: 'underline',
                                  fontWeight: 500,
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                Lihat Lampiran
                              </button>
                            )}
                          </div>
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
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Export</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>Dari Tanggal</label>
                <CustomDateInput
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>Sampai Tanggal</label>
                <CustomDateInput
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
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
                {exporting ? 'Mengunduh...' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Perizinan Modal */}
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
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Input Perizinan</h3>
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
                  Tanggal (Format: HH/BB/TTTT) *
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
                      lang="id-ID"
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
                  Shift Izin *
                </label>
                <select
                  value={dinasForm.shift}
                  onChange={(e) => setDinasForm({ ...dinasForm, shift: e.target.value })}
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
                  <option value="Seharian">Full</option>
                  <option value="Pagi">Shift Pagi</option>
                  <option value="Sore">Shift Sore</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                  Keterangan / Alasan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Sakit / Cuti / Tugas Luar"
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

              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                  Lampiran File Bukti (Opsional)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setDinasForm({ ...dinasForm, file: e.target.files[0] })}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
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
                  {submittingDinas ? 'Menyimpan...' : 'Simpan Perizinan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Preview Lampiran Modal */}
      {previewFile && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60,
          padding: '20px',
        }} className="animate-fade-in" onClick={() => setPreviewFile(null)}>
          <div 
            style={{
              position: 'relative',
              background: 'var(--color-bg-surface)',
              borderRadius: '16px',
              padding: '8px',
              maxWidth: '90%',
              maxHeight: '90%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px', padding: '0 8px' }}>
              <button
                onClick={() => setPreviewFile(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={24} />
              </button>
            </div>
            
            <div style={{ overflow: 'auto', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {previewFile.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={previewFile} 
                  title="Preview Lampiran"
                  style={{ width: '80vw', height: '80vh', border: 'none', borderRadius: '8px' }}
                />
              ) : previewFile.toLowerCase().match(/\.(doc|docx)$/) ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--color-text)' }}>Format dokumen tidak dapat dipratinjau langsung.</p>
                  <a 
                    href={previewFile} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      display: 'inline-block',
                      marginTop: '16px',
                      padding: '10px 20px',
                      background: '#4f46e5',
                      color: 'white',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: 600
                    }}
                  >
                    Download Dokumen
                  </a>
                </div>
              ) : (
                <img 
                  src={previewFile} 
                  alt="Lampiran Bukti" 
                  style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
