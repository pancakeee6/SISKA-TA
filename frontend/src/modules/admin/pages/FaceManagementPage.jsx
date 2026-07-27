import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ScanFace, Search, Trash2, Loader2, AlertCircle, User,
  Plus, Check, Camera, X, FlipHorizontal
} from 'lucide-react'
import Webcam from 'react-webcam'
import userApi from '../services/userApi'
import faceApi from '../services/faceApi'
import toast from 'react-hot-toast'

export default function FaceManagementPage() {
  const [searchParams] = useSearchParams()
  const userIdParam = searchParams.get('userId') || searchParams.get('user')

  // Users list
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [searchUser, setSearchUser] = useState('')

  // Selected user
  const [selectedUser, setSelectedUser] = useState(null)
  const [faces, setFaces] = useState([])
  const [loadingFaces, setLoadingFaces] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileInputRef = useRef(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Camera state
  const [showCamera, setShowCamera] = useState(false)
  const [isMirrored, setIsMirrored] = useState(false)
  const webcamRef = useRef(null)

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await userApi.list({ limit: 100, status: 'aktif' })
      setUsers(res.data.items || res.data || [])
    } catch {
      toast.error('Gagal memuat data user')
    } finally {
      setLoadingUsers(false)
    }
  }

  // Fetch all users
  useEffect(() => {
    // eslint-disable-next-line
    fetchUsers()
  }, [])

  // Fetch face data when user is selected
  const fetchFaces = useCallback(async (userId) => {
    if (!userId) return
    setLoadingFaces(true)
    try {
      const res = await faceApi.getByUser(userId)
      setFaces(res.data || [])
    } catch {
      toast.error('Gagal memuat data wajah')
      setFaces([])
    } finally {
      setLoadingFaces(false)
    }
  }, [])

  const handleSelectUser = (user) => {
    setSelectedUser(user)
    fetchFaces(user.id)
  }

  // Pre-select user from query params
  useEffect(() => {
    if (userIdParam && users.length > 0 && !selectedUser) {
      const found = users.find(u => u.id === userIdParam)
      if (found) {
        // eslint-disable-next-line
        handleSelectUser(found)
      }
    }
  // eslint-disable-next-line
  }, [userIdParam, users, selectedUser])

  // Shared file upload function
  const uploadFile = useCallback(async (file) => {
    if (!file || !selectedUser) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Format harus JPEG, PNG, atau WebP')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB')
      return
    }

    setUploading(true)
    setUploadProgress('Mengunggah gambar...')

    try {
      setUploadProgress('Mengekstrak embedding AI...')
      await faceApi.upload(selectedUser.id, file)
      toast.success('Data wajah berhasil disimpan')
      fetchFaces(selectedUser.id)
      
      // Update local user's face count
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, face_count: (u.face_count || 0) + 1 } : u))
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail?.includes('AI API')) {
        toast.error('AI API tidak tersedia. Pastikan service AI berjalan.')
      } else {
        toast.error(detail || 'Gagal mengunggah data wajah')
      }
    } finally {
      setUploading(false)
      setUploadProgress('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [selectedUser, fetchFaces])

  const captureFace = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" })
          setShowCamera(false)
          uploadFile(file)
        })
    }
  }, [webcamRef, uploadFile])

  // File input change handler
  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  // Delete face
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await faceApi.delete(deleteTarget.id)
      toast.success('Data wajah berhasil dihapus')
      setDeleteTarget(null)
      if (selectedUser) {
        fetchFaces(selectedUser.id)
        // Update local user's face count
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, face_count: Math.max(0, (u.face_count || 0) - 1) } : u))
      }
    } catch {
      toast.error('Gagal menghapus data wajah')
    } finally {
      setDeleting(false)
    }
  }

  // Filter users by search
  const filteredUsers = users.filter((u) =>
    !searchUser ||
    u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.employee_id?.toLowerCase().includes(searchUser.toLowerCase())
  )

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
              background: '#e0e7ff', color: '#4f46e5',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ScanFace size={24} strokeWidth={2} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
                Manajemen Wajah
              </h1>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                Kelola data embedding wajah pengguna untuk verifikasi AI
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                if (!selectedUser) {
                  toast.error('Pilih pengguna terlebih dahulu!')
                } else {
                  setShowCamera(true)
                }
              }}
              disabled={uploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#2563eb',
                fontWeight: 600,
                fontSize: '13px',
                border: '1px solid #bfdbfe',
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: uploading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!uploading) {
                  e.currentTarget.style.background = '#dbeafe';
                }
              }}
              onMouseLeave={(e) => {
                if (!uploading) {
                  e.currentTarget.style.background = '#eff6ff';
                }
              }}
            >
              <Camera size={16} strokeWidth={2.5} />
              <span>Ambil Foto</span>
            </button>
            
            <button
              onClick={() => {
                if (!selectedUser) {
                  toast.error('Pilih pengguna terlebih dahulu!')
                } else {
                  fileInputRef.current?.click()
                }
              }}
              disabled={uploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
                border: 'none',
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: uploading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!uploading) {
                  e.currentTarget.style.background = '#1d4ed8';
                }
              }}
              onMouseLeave={(e) => {
                if (!uploading) {
                  e.currentTarget.style.background = '#2563eb';
                }
              }}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{uploadProgress || 'Mengunggah...'}</span>
                </>
              ) : (
                <>
                  <Plus size={16} strokeWidth={2.5} />
                  <span>Upload Wajah</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              className="hidden"
              id="face-upload"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_340px] gap-6 items-start">
        {/* Left Column: Daftar Pengguna */}
        <div style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 200px)',
          minHeight: '500px',
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 12px 0' }}>
              Daftar Pengguna
            </h3>
            <div style={{ position: 'relative' }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Cari pengguna..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loadingUsers ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <User className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0 }}>
                  {searchUser ? 'Tidak ada user cocok' : 'Belum ada user'}
                </p>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isActive = selectedUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      background: isActive ? '#2563eb' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--color-bg-base)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
                      <img
                        src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.full_name)}`}
                        alt={user.full_name}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          background: 'var(--color-border)',
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
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isActive ? '#ffffff' : 'var(--color-text)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {user.full_name}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: isActive ? '#bfdbfe' : 'var(--color-text-secondary)',
                        margin: '2px 0 0 0',
                      }}>
                        {user.face_count || 0} foto
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Middle & Right columns display depending on selectedUser */}
        {!selectedUser ? (
          /* Empty state spans both middle and right columns for clean look */
          <div className="xl:col-span-2" style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            borderRadius: '16px',
            padding: '64px 24px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'var(--color-bg-base)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              fontSize: '40px',
            }}>
              🐱
            </div>
            <h3 style={{ color: 'var(--color-text)', fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>
              Belum Ada Pengguna Terpilih
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', maxWidth: '360px', margin: '0 auto' }}>
              Silakan pilih salah satu pengguna di panel sebelah kiri untuk mengelola data foto wajah mereka.
            </p>
          </div>
        ) : (
          <>
            {/* Middle Column: Data Wajah */}
            <div style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}>
              {/* Header Title with stats */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    Data Wajah - {selectedUser.full_name}
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '20px',
                    background: 'rgba(37, 99, 235, 0.1)',
                    color: '#2563eb',
                  }}>
                    {faces.length} / 3 foto
                  </span>
                </div>
                
                {faces.length >= 3 ? (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>
                    Siap untuk pengenalan
                  </span>
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#d97706' }}>
                    Belum siap (min. 3 foto)
                  </span>
                )}
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files?.[0]) {
                    uploadFile(e.dataTransfer.files[0]);
                  }
                }}
                style={{
                  border: dragActive ? '2px dashed #2563eb' : '1px dashed #cbd5e1',
                  background: dragActive ? '#eff6ff' : 'var(--color-bg-base)',
                  borderRadius: '12px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <span style={{ fontSize: '14px', color: 'var(--color-text)', fontWeight: 600 }}>
                  Drag & drop foto di sini
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>atau</span>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)',
                    transition: 'all 0.2s',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
                >
                  Pilih File
                </button>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  JPG, PNG, WebP - Maks. 5MB
                </span>
              </div>

              {/* Uploaded Portraits Grid */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 12px 0' }}>
                  Foto Wajah Terdaftar ({faces.length})
                </h4>
                {loadingFaces ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '36px' }}>
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  </div>
                ) : faces.length === 0 ? (
                  <div style={{
                    padding: '36px',
                    textAlign: 'center',
                    background: 'var(--color-bg-base)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border)',
                  }}>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0 }}>
                      Belum ada data foto wajah untuk pengguna ini.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                  }}>
                    {faces.map((face) => (
                      <div
                        key={face.id}
                        style={{
                          position: 'relative',
                          aspectRatio: '3/4',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          background: 'var(--color-bg-base)',
                          border: '1px solid var(--color-border)',
                        }}
                        className="group"
                      >
                        {face.image_path ? (
                          <img
                            src={`/api/v1/uploads/${face.image_path.split(/[/\\]/).pop()}`}
                            alt="Face data portrait"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = 'flex'
                              }
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            display: !face.image_path ? 'flex' : 'none',
                            width: '100%',
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8',
                          }}
                        >
                          <ScanFace size={32} />
                        </div>

                        {/* Delete Button overlay */}
                        <button
                          onClick={() => setDeleteTarget(face)}
                          title="Hapus foto"
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                            transition: 'all 0.2s',
                            zIndex: 10,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Tips & Progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Card 1: Tips Foto Wajah */}
              <div style={{
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                borderRadius: '16px',
                padding: '24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '18px' }}>💡</span>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                    Tips Foto Wajah
                  </h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    'Gunakan pencahayaan yang baik',
                    'Posisi wajah menghadap depan',
                    'Jangan gunakan kacamata hitam',
                    'Ekspresi wajah natural',
                    'Disarankan minimal 3 foto',
                  ].map((tip) => (
                    <div key={tip} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Check size={11} style={{ color: '#10b981' }} />
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: Progress */}
              <div style={{
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                borderRadius: '16px',
                padding: '24px',
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 16px 0' }}>
                  Progress
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    {faces.length} dari 3 foto
                  </span>
                  <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 700 }}>
                    {Math.min(100, Math.round((faces.length / 3) * 100))}%
                  </span>
                </div>

                {/* Progress bar line */}
                <div style={{
                  height: '8px',
                  borderRadius: '4px',
                  background: 'var(--color-border)',
                  overflow: 'hidden',
                  marginBottom: '12px',
                }}>
                  <div style={{
                    width: `${Math.min(100, (faces.length / 3) * 100)}%`,
                    height: '100%',
                    background: faces.length >= 3 ? '#10b981' : '#2563eb',
                    borderRadius: '4px',
                    transition: 'width 0.4s ease-out',
                  }} />
                </div>

                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {faces.length >= 3
                    ? 'Data wajah siap digunakan untuk absensi'
                    : `Unggah ${3 - faces.length} foto lagi untuk dapat digunakan untuk absensi.`}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm shadow-2xl animate-fade-up"
            style={{
              padding: '32px',
              borderRadius: '24px',
              background: 'var(--color-bg-surface)',
              border: '1px solid #fca5a5',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Hapus Foto</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Yakin ingin menghapus data wajah ini? Embedding AI juga akan dihapus.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => setDeleteTarget(null)}
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
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#ffffff',
                  background: '#dc2626',
                  border: 'none',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
                }}
                onMouseOver={(e) => { if(!deleting) e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseOut={(e) => { if(!deleting) e.currentTarget.style.filter = 'none' }}
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCamera(false)} />
          <div className="relative w-full max-w-md shadow-2xl animate-fade-up flex flex-col gap-3"
            style={{
              padding: '24px',
              borderRadius: '24px',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <button
              onClick={() => setShowCamera(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '50%',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-bg-base)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text)', paddingRight: '32px' }}>Ambil Foto Wajah</h3>
            <div className="rounded-xl overflow-hidden bg-black/90 aspect-[4/3] relative" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                mirrored={isMirrored}
                videoConstraints={{ facingMode: "user", aspectRatio: 4/3 }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onUserMediaError={(err) => console.error("Kamera error:", err)}
              />
              <button
                onClick={() => setIsMirrored(!isMirrored)}
                title={isMirrored ? "Matikan Efek Cermin" : "Aktifkan Efek Cermin"}
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px',
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  zIndex: 10
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
              >
                <FlipHorizontal size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', marginBottom: '4px' }}>
              <button
                onClick={captureFace}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  color: '#ffffff',
                  background: 'var(--color-primary)',
                  border: '4px solid rgba(56, 189, 248, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 20px rgba(56, 189, 248, 0.4)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                  e.currentTarget.style.border = '4px solid rgba(56, 189, 248, 0.5)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.border = '4px solid rgba(56, 189, 248, 0.3)'
                }}
                title="Jepret & Simpan"
              >
                <Camera size={28} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
