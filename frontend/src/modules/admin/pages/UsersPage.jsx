import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Plus, Search, Edit2, Trash2, X,
  ChevronLeft, ChevronRight, Loader2,
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
  const [statusFilter, setStatusFilter] = useState('aktif') // all | aktif | nonaktif
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
        search: search || undefined
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
  }, [page, search])

  useEffect(() => {
    // eslint-disable-next-line
    fetchUsers()
  }, [fetchUsers])

  // Reset page when search changes
  useEffect(() => {
    // eslint-disable-next-line
    setPage(1)
  }, [search])

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
            background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Users size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
              Pengguna
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              Kelola seluruh data pengguna dan akun pegawai SISKA
            </p>
          </div>
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
            background: '#2563eb',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1d4ed8';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#2563eb';
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
        gridTemplateColumns: 'repeat(2, 1fr)',
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
            bgColor: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)',
            iconColor: '#2563eb',
            iconBg: 'rgba(37, 99, 235, 0.1)'
          },
          {
            key: 'has_face',
            label: 'Punya Data Wajah',
            value: stats.has_face,
            icon: ScanFace,
            trend: `${stats.total > 0 ? Math.round((stats.has_face / stats.total) * 100) : 0}% dari total`,
            trendColor: '#7c3aed',
            bgColor: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)',
            iconColor: '#7c3aed',
            iconBg: 'rgba(139, 92, 246, 0.1)'
          },
        ].map(({ label, value, icon: Icon, trend, trendColor, bgColor, borderColor, iconColor, iconBg }) => (
          <div
            key={label}
            className="card-hover"
            style={{
              borderRadius: '16px',
               padding: '20px',
               background: bgColor,
               border: `1px solid ${borderColor}`,
               boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
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
                color: 'var(--color-text)',
                margin: 0,
                lineHeight: 1.1,
              }}>{loading ? '—' : value}</p>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500, margin: '2px 0 0 0' }}>{label}</p>
              <p style={{ fontSize: '11px', color: trendColor, margin: '4px 0 0 0', fontWeight: 600 }}>{trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Table Container */}
      <div className="animate-fade-up stagger-2" style={{
        borderRadius: '16px',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
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
          borderBottom: '1px solid var(--color-border)',
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
                  background: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

          </div>

          {!loading && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500, margin: 0 }}>
              Menampilkan {Math.min(limit, users.length)} dari {total} pengguna
            </p>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-base)' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'none' }}>Pengguna</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'none' }}>NIM</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'none' }}>Email</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'none' }}>Program Studi</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'none' }}>Wajah</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'none', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody style={{ divideY: '1px solid #f1f5f9' }}>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} style={{ padding: '16px 20px' }}>
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '64px 20px', textAlign: 'center' }}>
                    <div className="text-4xl mb-3">🐱</div>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                      {search ? 'Tidak ada pengguna yang cocok' : 'Belum ada pengguna'}
                    </p>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '4px', margin: 0 }}>
                      {search ? 'Coba kata kunci lain' : 'Yuk, tambahkan pengguna pertama untuk memulai!'}
                    </p>
                    {!search && (
                      <button
                        onClick={openCreate}
                        style={{
                          marginTop: '16px',
                          padding: '8px 16px',
                          borderRadius: '10px',
                          background: '#2563eb',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
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
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-base)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
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
                              background: '#f1f5f9',
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
                              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                            }}
                          >
                            {user.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {user.full_name}
                        </span>
                      </div>
                    </td>

                    {/* NIM */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontWeight: 500 }}>
                        {user.employee_id}
                      </span>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        {user.email || '—'}
                      </span>
                    </td>

                    {/* Program Studi */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        {user.department || '—'}
                      </span>
                    </td>

                    {/* Wajah */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
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
                            background: 'var(--color-bg-base)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(37, 99, 235, 0.4)';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.background = '#2563eb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.border = '1px solid #e2e8f0';
                            e.currentTarget.style.color = '#64748b';
                            e.currentTarget.style.background = '#f8fafc';
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
                            background: 'var(--color-bg-base)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(124, 58, 237, 0.4)';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.background = '#7c3aed';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.border = '1px solid #e2e8f0';
                            e.currentTarget.style.color = '#64748b';
                            e.currentTarget.style.background = '#f8fafc';
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
                            background: 'var(--color-bg-base)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(239, 68, 68, 0.4)';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.background = '#ef4444';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.border = '1px solid #e2e8f0';
                            e.currentTarget.style.color = '#64748b';
                            e.currentTarget.style.background = '#f8fafc';
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
            borderTop: '1px solid #f1f5f9',
          }}>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500, margin: 0 }}>
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
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  color: page <= 1 ? '#cbd5e1' : '#475569',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (page > 1) {
                    e.currentTarget.style.border = '1px solid #2563eb';
                    e.currentTarget.style.color = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '1px solid #cbd5e1';
                  e.currentTarget.style.color = page <= 1 ? '#cbd5e1' : '#475569';
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
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      background: isActive ? '#2563eb' : '#ffffff',
                      color: isActive ? '#ffffff' : '#475569',
                      boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.color = '#0f172a';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.color = '#475569';
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
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  color: page >= totalPages ? '#cbd5e1' : '#475569',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (page < totalPages) {
                    e.currentTarget.style.border = '1px solid #2563eb';
                    e.currentTarget.style.color = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '1px solid #cbd5e1';
                  e.currentTarget.style.color = page >= totalPages ? '#cbd5e1' : '#475569';
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md shadow-2xl animate-fade-up"
            style={{
              padding: '32px',
              borderRadius: '24px',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                {modalMode === 'create' ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                  NIP / Employee ID
                </label>
                <input
                  type="text"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--color-text)',
                    background: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#38bdf8'; e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.15)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
                  placeholder="Contoh: NIP001"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--color-text)',
                    background: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#38bdf8'; e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.15)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
                  placeholder="Nama lengkap"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                  Email (opsional)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--color-text)',
                    background: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#38bdf8'; e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.15)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
                  placeholder="email@contoh.com"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                  Departemen (opsional)
                </label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--color-text)',
                    background: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#38bdf8'; e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.15)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
                  placeholder="IT, HRD, Finance, dll"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    borderRadius: '8px', 
                    fontWeight: 600, 
                    fontSize: '14px', 
                    border: '1px solid var(--color-border)', 
                    color: 'var(--color-text-secondary)', 
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-bg-base)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '14px',
                    color: '#ffffff',
                    background: 'var(--color-primary)',
                    border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)'
                  }}
                  onMouseOver={(e) => { if(!saving) e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseOut={(e) => { if(!saving) e.currentTarget.style.filter = 'none' }}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setDeleteTarget(null)} />
          <div className="animate-fade-up"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '400px',
              padding: '32px',
              borderRadius: '24px',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
            }}>
              <Trash2 size={32} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px', marginTop: 0 }}>Hapus Pengguna</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 32px 0' }}>
              Apakah Anda yakin ingin menghapus pengguna <br />
              <strong style={{ color: 'var(--color-text)' }}>{deleteTarget?.full_name}</strong>?<br />
              Data ini tidak dapat dikembalikan.
            </p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-bg-base)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#ffffff',
                  background: '#ef4444',
                  border: 'none',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
                }}
                onMouseOver={(e) => { if(!deleting) e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseOut={(e) => { if(!deleting) e.currentTarget.style.filter = 'none' }}
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
