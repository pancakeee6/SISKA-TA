import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ScanFace, Search, Upload, Trash2, X, ChevronDown,
  Image, Loader2, AlertCircle, CheckCircle, User,
} from 'lucide-react'
import userApi from '../services/userApi'
import faceApi from '../services/faceApi'
import toast from 'react-hot-toast'

export default function FaceManagementPage() {
  // Users list
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [searchUser, setSearchUser] = useState('')

  // Selected user
  const [selectedUser, setSelectedUser] = useState(null)
  const [faces, setFaces] = useState([])
  const [loadingFaces, setLoadingFaces] = useState(false)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileInputRef = useRef(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch all users
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await userApi.list({ limit: 100 })
      setUsers(res.data.items || res.data || [])
    } catch {
      toast.error('Gagal memuat data user')
    } finally {
      setLoadingUsers(false)
    }
  }

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

  // File upload handler
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
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
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Delete face
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await faceApi.delete(deleteTarget.id)
      toast.success('Data wajah berhasil dihapus')
      setDeleteTarget(null)
      if (selectedUser) fetchFaces(selectedUser.id)
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
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ScanFace className="w-6 h-6 text-indigo-400" />
          Manajemen Data Wajah
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Upload dan kelola data wajah untuk AI face recognition
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: User selector */}
        <div className="lg:col-span-1">
          <div className="bg-[#1a1d2e] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white mb-3">Pilih User</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]
                             text-white placeholder-slate-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder="Cari nama atau NIP..."
                />
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {loadingUsers ? (
                <div className="p-6 flex justify-center">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center">
                  <User className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">
                    {searchUser ? 'Tidak ada user cocok' : 'Belum ada user'}
                  </p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left
                               transition-all cursor-pointer border-b border-white/[0.03] last:border-0
                               ${selectedUser?.id === user.id
                                 ? 'bg-indigo-600/15 border-l-2 !border-l-indigo-500'
                                 : 'hover:bg-white/[0.03]'
                               }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      selectedUser?.id === user.id
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                        : 'bg-white/[0.06] text-slate-400'
                    }`}>
                      {user.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        selectedUser?.id === user.id ? 'text-white' : 'text-slate-300'
                      }`}>
                        {user.full_name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user.employee_id}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Face data panel */}
        <div className="lg:col-span-2">
          {!selectedUser ? (
            /* No user selected */
            <div className="bg-[#1a1d2e] rounded-2xl border border-white/[0.06] p-12 text-center">
              <ScanFace className="w-14 h-14 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 text-lg font-medium mb-1">Pilih User</p>
              <p className="text-slate-600 text-sm">
                Pilih user dari daftar di sebelah kiri untuk mengelola data wajah
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected user header + upload */}
              <div className="bg-[#1a1d2e] rounded-2xl border border-white/[0.06] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-indigo-500/20">
                      {selectedUser.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{selectedUser.full_name}</p>
                      <p className="text-slate-500 text-xs">{selectedUser.employee_id} · {selectedUser.department || 'No dept'}</p>
                    </div>
                  </div>

                  {/* Upload button */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleUpload}
                      className="hidden"
                      id="face-upload"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600
                                 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium rounded-xl
                                 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer active:scale-[0.98]
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {uploadProgress}
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload Wajah
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Upload tips */}
                <div className="mt-4 px-4 py-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                  <p className="text-xs text-indigo-300 font-medium mb-1">Tips Upload:</p>
                  <ul className="text-xs text-slate-500 space-y-0.5">
                    <li>• Format: JPEG, PNG, atau WebP (max 5MB)</li>
                    <li>• Pastikan wajah terlihat jelas dan menghadap kamera</li>
                    <li>• Pencahayaan yang baik akan meningkatkan akurasi</li>
                    <li>• Disarankan minimal 2-3 foto dari sudut berbeda</li>
                  </ul>
                </div>
              </div>

              {/* Face data grid */}
              <div className="bg-[#1a1d2e] rounded-2xl border border-white/[0.06] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">
                    Data Wajah Terdaftar
                  </h3>
                  <span className="text-xs text-slate-500">
                    {faces.length} foto
                  </span>
                </div>

                {loadingFaces ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  </div>
                ) : faces.length === 0 ? (
                  <div className="text-center py-12">
                    <Image className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm mb-1">Belum ada data wajah</p>
                    <p className="text-slate-600 text-xs">Upload foto wajah untuk registrasi face recognition</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 text-indigo-400 text-sm hover:underline cursor-pointer"
                    >
                      + Upload foto pertama
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {faces.map((face) => (
                      <div
                        key={face.id}
                        className="group relative bg-white/[0.03] rounded-xl border border-white/[0.06]
                                   overflow-hidden hover:border-white/[0.12] transition-all"
                      >
                        {/* Face image */}
                        <div className="aspect-square bg-black/30 flex items-center justify-center">
                          {face.image_path ? (
                            <img
                              src={`/api/v1/uploads/${face.image_path.split(/[/\\]/).pop()}`}
                              alt="Face data"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full items-center justify-center text-slate-600 hidden">
                            <ScanFace className="w-8 h-8" />
                          </div>
                          {!face.image_path && (
                            <ScanFace className="w-8 h-8 text-slate-600" />
                          )}
                        </div>

                        {/* Info overlay */}
                        <div className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-medium">Terdaftar</span>
                          </div>
                          <p className="text-[10px] text-slate-600 mt-0.5">
                            {new Date(face.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </p>
                        </div>

                        {/* Delete button (hover) */}
                        <button
                          onClick={() => setDeleteTarget(face)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-slate-400
                                     hover:text-red-400 hover:bg-red-500/20 transition-all cursor-pointer
                                     opacity-0 group-hover:opacity-100"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm bg-[#1a1d2e] rounded-2xl border border-white/[0.08] shadow-2xl p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-500/10">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Hapus Data Wajah</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Yakin ingin menghapus data wajah ini? Embedding AI juga akan dihapus.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-slate-300 text-sm
                           hover:bg-white/[0.04] transition-all cursor-pointer"
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
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
