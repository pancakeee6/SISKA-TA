import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Plus, Search, Edit2, Trash2, X,
  ChevronLeft, ChevronRight, AlertCircle, Loader2,
  UserCheck, UserX, ScanFace, ChevronDown
} from 'lucide-react'
import userApi from '../services/userApi'
import toast from 'react-hot-toast'

const INITIAL_FORM = {
  employee_id: '',
  full_name: '',
  email: '',
  department: '',
}

export default function UsersPage() {
  const navigate = useNavigate()

  // Data state
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | aktif | nonaktif
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    has_face: 0
  })

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // create | edit
  const [form, setForm] = useState(INITIAL_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const limit = 10

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await userApi.list({ 
        page, 
        limit, 
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      })
      setUsers(res.data.items || res.data)
      setTotal(res.data.total || (res.data.items || res.data).length)
      if (res.data.stats) {
        setStats(res.data.stats)
      }
    } catch {
      toast.error('Gagal memuat data user')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  // Modal handlers
  const openCreate = () => {
    setForm(INITIAL_FORM)
    setModalMode('create')
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (user) => {
    setForm({
      employee_id: user.employee_id || '',
      full_name: user.full_name || '',
      email: user.email || '',
      department: user.department || '',
    })
    setEditingId(user.id)
    setModalMode('edit')
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modalMode === 'create') {
        await userApi.create(form)
        toast.success('User berhasil ditambahkan')
      } else {
        await userApi.update(editingId, form)
        toast.success('User berhasil diupdate')
      }
      setModalOpen(false)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await userApi.delete(deleteTarget.id)
      toast.success(`User "${deleteTarget.full_name}" dihapus`)
      setDeleteTarget(null)
      fetchUsers()
    } catch {
      toast.error('Gagal menghapus user')
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Pengguna
          </h1>
          <p style={{ fontSize: '14px', color: '#8494a7', margin: '4px 0 0 0' }}>
            Kelola seluruh pengguna sistem SISKA
          </p>
        </div>
        <button
          id="btn-add-user"
          onClick={openCreate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            background: '#3b82f6',
            color: '#ffffff',
            fontWeight: 500,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2563eb';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#3b82f6';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <Plus size={16} />
          Tambah Pengguna
        </button>
      </div>

      {/* Mini Stats Row */}
      <div className="animate-fade-up stagger-1" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
      }}>
        {[
          {
            key: 'total',
            label: 'Total Pengguna',
            value: stats.total,
            icon: Users,
            trend: '▲ 5 minggu ini',
            trendColor: '#10b981',
            bgColor: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)',
            borderColor: 'rgba(59, 130, 246, 0.15)',
            iconColor: '#3b82f6',
            iconBg: 'rgba(59, 130, 246, 0.15)'
          },
          {
            key: 'active',
            label: 'Aktif',
            value: stats.active,
            icon: UserCheck,
            trend: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% dari total`,
            trendColor: '#10b981',
            bgColor: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)',
            borderColor: 'rgba(16, 185, 129, 0.15)',
            iconColor: '#10b981',
            iconBg: 'rgba(16, 185, 129, 0.15)'
          },
          {
            key: 'inactive',
            label: 'Nonaktif',
            value: stats.inactive,
            icon: UserX,
            trend: `${stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0}% dari total`,
            trendColor: '#f59e0b',
            bgColor: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)',
            borderColor: 'rgba(245, 158, 11, 0.15)',
            iconColor: '#f59e0b',
            iconBg: 'rgba(245, 158, 11, 0.15)'
          },
          {
            key: 'has_face',
            label: 'Punya Data Wajah',
            value: stats.has_face,
            icon: ScanFace,
            trend: `${stats.total > 0 ? Math.round((stats.has_face / stats.total) * 100) : 0}% dari total`,
            trendColor: '#a78bfa',
            bgColor: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)',
            borderColor: 'rgba(139, 92, 246, 0.15)',
            iconColor: '#a78bfa',
            iconBg: 'rgba(139, 92, 246, 0.15)'
          },
        ].map(({ label, value, icon: Icon, trend, trendColor, bgColor, borderColor, iconColor, iconBg }) => (
          <div
            key={label}
            style={{
              borderRadius: '16px',
               padding: '20px',
               background: bgColor,
               border: `1px solid ${borderColor}`,
               display: 'flex',
               alignItems: 'center',
               gap: '16px',
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon size={22} style={{ color: iconColor }} />
            </div>
            <div>
              <p style={{
                fontSize: '32px',
                fontWeight: 800,
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.1,
              }}>{loading ? '—' : value}</p>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>{label}</p>
              <p style={{ fontSize: '11px', color: trendColor, margin: '4px 0 0 0', fontWeight: 500 }}>{trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Table Container */}
      <div className="animate-fade-up stagger-2" style={{
        borderRadius: '16px',
        background: 'linear-gradient(180deg, #0d1a2d 0%, #091220 100%)',
        border: '1px solid rgba(56, 189, 248, 0.08)',
        overflow: 'hidden',
      }}>
        {/* Search & Filter Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '260px' }}>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="search-users"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, email, atau NIM..."
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 40px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.3)',
                  border: '1px solid rgba(56, 189, 248, 0.08)',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Dropdown status */}
            <div style={{ position: 'relative' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  appearance: 'none',
                  padding: '10px 36px 10px 16px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.3)',
                  border: '1px solid rgba(56, 189, 248, 0.08)',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                  minWidth: '130px',
                }}
              >
                <option value="all">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {!loading && (
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Menampilkan {Math.min(limit, users.length)} dari {total} pengguna
            </p>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#8494a7', textTransform: 'none' }}>Pengguna</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#8494a7', textTransform: 'none' }}>NIM</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#8494a7', textTransform: 'none' }}>Email</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#8494a7', textTransform: 'none' }}>Program Studi</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#8494a7', textTransform: 'none' }}>Status</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#8494a7', textTransform: 'none' }}>Wajah</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#8494a7', textTransform: 'none', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody style={{ divideY: '1px solid rgba(255, 255, 255, 0.02)' }}>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)' }}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} style={{ padding: '16px 20px' }}>
                        <div className="h-4 bg-white/[0.04] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '64px 20px', textAlign: 'center' }}>
                    <div className="text-4xl mb-3">🐱</div>
                    <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500, margin: 0 }}>
                      {search ? 'Tidak ada pengguna yang cocok' : 'Belum ada pengguna'}
                    </p>
                    <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', margin: 0 }}>
                      {search ? 'Coba kata kunci lain' : 'Yuk, tambahkan pengguna pertama untuk memulai!'}
                    </p>
                    {!search && (
                      <button
                        onClick={openCreate}
                        style={{
                          marginTop: '16px',
                          padding: '8px 16px',
                          borderRadius: '10px',
                          background: '#3b82f6',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 500,
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                        }}
                      >
                        <Plus size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                        <span style={{ verticalAlign: 'middle' }}>Tambah Pengguna</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                      transition: 'background 0.2s',
                    }}
                    className="hover:bg-white/[0.02]"
                  >
                    {/* Pengguna (Avatar + Nama) */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
                          <img
                            src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.full_name)}`}
                            alt={user.full_name}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              background: 'rgba(255, 255, 255, 0.05)',
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                          <div
                            style={{
                              display: 'none',
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              color: '#ffffff',
                              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            }}
                          >
                            {user.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>
                          {user.full_name}
                        </span>
                      </div>
                    </td>

                    {/* NIM */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                        {user.employee_id}
                      </span>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: '#8494a7' }}>
                        {user.email || '—'}
                      </span>
                    </td>

                    {/* Program Studi */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: '#cbd5e1' }}>
                        {user.department || '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '16px 20px' }}>
                      {user.is_active !== false ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                        }}>
                          Aktif
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                        }}>
                          Nonaktif
                        </span>
                      )}
                    </td>

                    {/* Wajah */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: '#cbd5e1' }}>
                        {user.face_count || 0} foto
                      </span>
                    </td>

                    {/* Aksi */}
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {/* Face Scan Action */}
                        <button
                          onClick={() => navigate(`/admin/faces?userId=${user.id}`)}
                          title="Kelola Wajah"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(56, 189, 248, 0.3)';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          }}
                        >
                          <ScanFace size={16} />
                        </button>

                        {/* Edit Action */}
                        <button
                          onClick={() => openEdit(user)}
                          title="Edit Pengguna"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(167, 139, 250, 0.3)';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.background = 'rgba(167, 139, 250, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          }}
                        >
                          <Edit2 size={15} />
                        </button>

                        {/* Delete Action */}
                        <button
                          onClick={() => setDeleteTarget(user)}
                          title="Hapus"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(248, 113, 113, 0.3)';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          }}>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Halaman {page} dari {totalPages} ({total} total)
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  color: page <= 1 ? '#475569' : '#94a3b8',
                  fontSize: '13px',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (page > 1) {
                    e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = page <= 1 ? '#475569' : '#94a3b8';
                }}
              >
                <ChevronLeft size={16} />
                Sebelumnya
              </button>

              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                const isActive = page === pageNum;
                return (
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
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: 'none',
                      background: isActive ? '#3b82f6' : 'transparent',
                      color: isActive ? '#ffffff' : '#94a3b8',
                      boxShadow: isActive ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = '#ffffff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#94a3b8';
                      }
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  color: page >= totalPages ? '#475569' : '#94a3b8',
                  fontSize: '13px',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (page < totalPages) {
                    e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = page >= totalPages ? '#475569' : '#94a3b8';
                }}
              >
                Selanjutnya
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl p-6 animate-fade-up"
            style={{
              background: 'linear-gradient(180deg, #111d35, #0f1a30)',
              border: '1px solid rgba(56, 189, 248, 0.1)',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">
                {modalMode === 'create' ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">NIP / Employee ID</label>
                <input
                  type="text"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(56, 189, 248, 0.1)',
                  }}
                  placeholder="Contoh: NIP001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(56, 189, 248, 0.1)',
                  }}
                  placeholder="Nama lengkap"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email (opsional)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(56, 189, 248, 0.1)',
                  }}
                  placeholder="email@contoh.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Departemen (opsional)</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(56, 189, 248, 0.1)',
                  }}
                  placeholder="IT, HRD, Finance, dll"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-slate-300 text-sm
                             hover:bg-white/[0.04] transition-all cursor-pointer"
                  style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-white text-sm font-medium
                             rounded-xl transition-all disabled:opacity-50 cursor-pointer
                             active:scale-[0.98] inline-flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                    boxShadow: '0 4px 15px rgba(56, 189, 248, 0.25)',
                  }}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {modalMode === 'create' ? 'Tambah' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-fade-up"
            style={{
              background: 'linear-gradient(180deg, #111d35, #0f1a30)',
              border: '1px solid rgba(248, 113, 113, 0.15)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-500/10">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Hapus Pengguna</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Yakin ingin menghapus <strong className="text-white">{deleteTarget.full_name}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-slate-300 text-sm
                           hover:bg-white/[0.04] transition-all cursor-pointer"
                style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600
                           hover:from-red-500 hover:to-rose-500 text-white text-sm font-medium
                           rounded-xl transition-all disabled:opacity-50 cursor-pointer
                           inline-flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
