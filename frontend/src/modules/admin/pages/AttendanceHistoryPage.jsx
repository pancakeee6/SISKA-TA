import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardList, Search, Calendar, ChevronLeft, ChevronRight,
  Clock, UserCheck, ArrowDownUp, LogIn, LogOut, Loader2,
  Download, Filter, X,
} from 'lucide-react'
import attendanceAdminApi from '../services/attendanceAdminApi'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as localeID } from 'date-fns/locale'

const PER_PAGE = 15

export default function AttendanceHistoryPage() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterDate, setFilterDate] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState(0)

  // Export state
  const [showExport, setShowExport] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exporting, setExporting] = useState(false)

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        per_page: PER_PAGE,
      }
      if (filterDate) params.date = filterDate
      if (search) params.search = search

      const res = await attendanceAdminApi.getLogs(params)
      setLogs(res.data.logs || [])
      setTotal(res.data.total || 0)
    } catch {
      toast.error('Gagal memuat riwayat kehadiran')
    } finally {
      setLoading(false)
    }
  }, [page, filterDate, search])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [filterDate, search])

  // Count active filters
  useEffect(() => {
    let count = 0
    if (filterDate) count++
    if (search) count++
    setActiveFilters(count)
  }, [filterDate, search])

  const clearFilters = () => {
    setFilterDate('')
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
      return format(new Date(ts), 'dd MMM yyyy', { locale: localeID })
    } catch {
      return '-'
    }
  }

  const formatFullDate = (ts) => {
    try {
      return format(new Date(ts), 'EEEE, dd MMMM yyyy', { locale: localeID })
    } catch {
      return '-'
    }
  }

  const totalPages = Math.ceil(total / PER_PAGE) || 1

  // Today's date for the filter max value
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-400" />
            Riwayat Kehadiran
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {total} catatan kehadiran
            {filterDate && ` — ${formatFullDate(filterDate + 'T00:00:00')}`}
          </p>
        </div>

        {/* Export button */}
        <button
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08]
                     hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-xl
                     transition-all cursor-pointer active:scale-[0.98]"
          onClick={() => setShowExport(true)}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Date filter */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="date"
            value={filterDate}
            max={today}
            onChange={(e) => setFilterDate(e.target.value)}
            className="pl-10 pr-4 py-2.5 rounded-xl bg-[#1a1d2e] border border-white/[0.06]
                       text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50
                       transition-all [color-scheme:dark]"
          />
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1a1d2e] border border-white/[0.06]
                       text-white placeholder-slate-500 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50
                       transition-all"
            placeholder="Cari nama karyawan..."
          />
        </div>

        {/* Clear filters */}
        {activeFilters > 0 && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm
                       text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Hapus filter ({activeFilters})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#1a1d2e] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nama
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  Tanggal
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Waktu
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                  Device
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-white/[0.04] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">
                      {activeFilters > 0
                        ? 'Tidak ada data kehadiran yang cocok'
                        : 'Belum ada riwayat kehadiran'}
                    </p>
                    {activeFilters > 0 && (
                      <button
                        onClick={clearFilters}
                        className="text-indigo-400 text-sm mt-2 hover:underline cursor-pointer"
                      >
                        Hapus semua filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* User name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-300 text-xs font-bold ring-1 ring-indigo-500/20 shrink-0">
                          {log.user_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm text-white font-medium">{log.user_name || 'Unknown'}</span>
                      </div>
                    </td>

                    {/* Event type */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                        log.event_type === 'IN'
                          ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
                      }`}>
                        {log.event_type === 'IN' ? (
                          <LogIn className="w-3 h-3" />
                        ) : (
                          <LogOut className="w-3 h-3" />
                        )}
                        {log.event_type === 'IN' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-sm text-slate-400">{formatDate(log.timestamp)}</span>
                    </td>

                    {/* Time */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-white font-mono">{formatTime(log.timestamp)}</span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {log.late ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                                         bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                          <Clock className="w-3 h-3" />
                          Terlambat
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                                         bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                          <UserCheck className="w-3 h-3" />
                          Tepat Waktu
                        </span>
                      )}
                    </td>

                    {/* Device */}
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-xs text-slate-500 font-mono">{log.device_id || '-'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
            <p className="text-xs text-slate-500">
              Halaman {page} dari {totalPages} ({total} total)
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04]
                           disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                // Smart page number display
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      page === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04]
                           disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowExport(false)} />
          <div className="relative w-full max-w-sm bg-[#1a1d2e] rounded-2xl border border-white/[0.08] shadow-2xl p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-indigo-500/10">
                <Download className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Export CSV</h3>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Dari Tanggal</label>
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]
                             text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                             [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Sampai Tanggal</label>
                <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]
                             text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                             [color-scheme:dark]"
                />
              </div>
              <p className="text-[11px] text-slate-600">Kosongkan untuk export semua data</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExport(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-slate-300 text-sm
                           hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600
                           hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium
                           rounded-xl transition-all disabled:opacity-50 cursor-pointer
                           inline-flex items-center justify-center gap-2"
              >
                {exporting && <Loader2 className="w-4 h-4 animate-spin" />}
                {exporting ? 'Mengunduh...' : 'Download CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
