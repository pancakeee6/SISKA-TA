import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@shared/store/authStore'
import { 
  Save, User, Lock, Shield, Camera, Clock, Plus, Trash2, Bell, 
  Mail, CheckCircle2, AlertTriangle, Key, Sliders, 
  Moon, Sun, Monitor, Eye, EyeOff, Check, ArrowRight, Pencil
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@shared/services/api'

export default function SettingsPage() {
  const { admin, setAdmin } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile') // profile | security | shifts | preferences
  const [shiftSettings, setShiftSettings] = useState(null)
  const fileInputRef = useRef(null)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const [newShiftForm, setNewShiftForm] = useState(null)

  // Profile Form state
  const [form, setForm] = useState({
    full_name: admin?.full_name || '',
    username: admin?.username || '',
    email: admin?.email || '',
    avatar: admin?.avatar !== undefined ? admin.avatar : null,
  })

  // Security Form state
  const [secForm, setSecForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)

  // Preferences Form state
  const [prefForm, setPrefForm] = useState({
    theme_mode: localStorage.getItem('theme') || 'light',
  })

  useEffect(() => {
    if (admin) {
      setForm(prev => ({
        full_name: admin.full_name !== undefined ? admin.full_name : prev.full_name,
        username: admin.username !== undefined ? admin.username : prev.username,
        email: admin.email !== undefined ? admin.email : prev.email,
        avatar: admin.avatar !== undefined ? admin.avatar : prev.avatar,
      }))
    }
  }, [admin])

  useEffect(() => {
    api.get('/api/v1/settings/shifts')
      .then(res => {
        // Ensure tolerance field exists on each shift
        const data = res.data || {}
        const shifts = (data.shifts || []).map(s => ({
          ...s,
          tolerance: s.tolerance || '15'
        }))
        setShiftSettings({ ...data, shifts })
      })
      .catch(err => {
        console.error("Gagal mengambil pengaturan shift", err)
        setShiftSettings({
          shifts: [
            { id: 1, name: "Shift Pagi", start_time: "08:00", end_time: "15:00", tolerance: "15" },
            { id: 2, name: "Shift Sore", start_time: "15:00", end_time: "21:00", tolerance: "15" }
          ]
        })
      })
  }, [])

  const handleProfileChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSecChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setSecForm({ ...secForm, [e.target.name]: value })
  }

  const handlePrefChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setPrefForm({ ...prefForm, [e.target.name]: value })
  }

  const handleShiftChange = (index, field, value) => {
    if (!shiftSettings?.shifts) return
    const newShifts = [...shiftSettings.shifts]
    newShifts[index][field] = value
    setShiftSettings({ ...shiftSettings, shifts: newShifts })
  }

  const handleAddShift = () => {
    const nextNum = (shiftSettings?.shifts?.length || 0) + 1
    setNewShiftForm({
      name: `Shift ${nextNum} (Tambahan)`,
      start_time: '08:00',
      end_time: '16:00',
      tolerance: '15'
    })
  }

  const handleDeleteShift = (index) => {
    if (!shiftSettings?.shifts) return
    const newShifts = shiftSettings.shifts.filter((_, i) => i !== index)
    setShiftSettings({ ...shiftSettings, shifts: newShifts })
    toast.success('Shift dihapus dari daftar sementara. Klik Simpan Perubahan untuk memperbarui permanen.')
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ukuran gambar maksimal 2MB')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setForm({ ...form, avatar: reader.result })
      }
      reader.readAsDataURL(file)
    }
  }

  // Password strength logic
  const getPasswordStrength = (pass) => {
    if (!pass) return { label: '-', color: '#94a3b8', score: 0 }
    if (pass.length < 6) return { label: 'Lemah', color: '#ef4444', score: 25 }
    if (pass.length < 8) return { label: 'Sedang', color: '#f59e0b', score: 50 }
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass) && pass.length >= 8) {
      return { label: 'Sangat Kuat', color: '#10b981', score: 100 }
    }
    return { label: 'Kuat', color: '#3b82f6', score: 75 }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { full_name: form.full_name, username: form.username, email: form.email, avatar: form.avatar }
      const { data } = await api.put('/api/v1/auth/me', payload)
      setAdmin(data.admin)
      toast.success('Profil admin berhasil diperbarui!')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan profil')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSecurity = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (secForm.new_password || secForm.current_password) {
        if (!secForm.current_password) return toast.error('Masukkan password saat ini.')
        if (secForm.new_password !== secForm.confirm_password) return toast.error('Password tidak cocok!')
        if (secForm.new_password.length < 6) return toast.error('Password minimal 6 karakter.')
        
        const payload = { current_password: secForm.current_password, new_password: secForm.new_password }
        await api.put('/api/v1/auth/me', payload)
      }
      toast.success('Pengaturan keamanan berhasil diperbarui!')
      setSecForm(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }))
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan keamanan')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveShifts = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (shiftSettings) {
        await api.put('/api/v1/settings/shifts', shiftSettings)
        toast.success('Pengaturan jadwal shift berhasil diperbarui!')
      }
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan shift')
    } finally {
      setLoading(false)
    }
  }

  const strength = getPasswordStrength(secForm.new_password)

  const tabs = [
    { id: 'profile', label: 'Profil Admin', icon: User, desc: 'Informasi personal & kontak' },
    { id: 'security', label: 'Keamanan Akses', icon: Shield, desc: 'Pembaruan kata sandi admin' },
    { id: 'shifts', label: 'Jam Shift & Toleransi', icon: Clock, desc: 'Aturan & jam kerja absensi' },
    { id: 'preferences', label: 'Preferensi Sistem', icon: Sliders, desc: 'Tampilan antarmuka sistem' },
  ]

  return (
    <div style={{ width: '100%', maxWidth: '1160px', margin: '0 auto', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 40px)' }} className="animate-fade-in">
      
      {/* MAIN TWO-COLUMN LAYOUT */}

      {/* 2. MAIN SETTINGS GRID (SIDEBAR TABS + CONTENT FORM) */}
      <div style={{ 
        display: 'grid', gridTemplateColumns: '280px 1fr', flex: 1, minHeight: 0,
        background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
        borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', overflow: 'hidden'
      }}>
        
        {/* Left Tab Navigation */}
        <div style={{ 
          borderRight: '1px solid var(--color-border)', 
          padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px',
          overflowY: 'auto', background: 'var(--color-bg-surface)'
        }}>
          <div style={{ padding: '8px 12px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Kategori Pengaturan
            </span>
          </div>
          
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px', borderRadius: '14px', border: 'none',
                  background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                  cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'left',
                  fontWeight: isActive ? 700 : 600,
                  position: 'relative', outline: 'none'
                }}
                onMouseOver={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--color-bg-base)' }}
                onMouseOut={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ 
                  width: '36px', height: '36px', borderRadius: '10px', 
                  background: isActive ? 'var(--color-primary)' : 'var(--color-bg-base)',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <tab.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', lineHeight: 1.2 }}>{tab.label}</div>
                  <div style={{ fontSize: '11.5px', color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: 500, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab.desc}
                  </div>
                </div>
                {isActive && (
                  <div style={{ width: '4px', height: '22px', background: 'var(--color-primary)', borderRadius: '4px', position: 'absolute', right: '4px' }} />
                )}
              </button>
            )
          })}

        </div>

        {/* Right Content Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', height: '100%', overflowY: 'auto' }} className="no-scrollbar">

          {/* TAB 1: PROFILE & CONTACT */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px', flex: 1 }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Informasi Pribadi & Kontak</h2>
                <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: 0 }}>Atur identitas resmi dan saluran komunikasi administrator sistem.</p>
              </div>

              {/* Form & Avatar Container */}
              <div style={{ display: 'flex', gap: '48px', alignItems: 'flex-start' }}>
                
                {/* Left Side: Avatar Upload Box & Info */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, marginTop: '8px', width: '260px' }}>
                  <div style={{ position: 'relative', marginBottom: '24px' }}>
                    <div style={{
                      width: '240px', height: '240px', borderRadius: '50%',
                      border: '4px solid var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', background: 'var(--color-bg-base)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                    }}>
                      {form.avatar ? (
                        <img src={form.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={100} color="#94a3b8" />
                      )}
                    </div>
                    {/* Floating Edit Dropdown */}
                    <div 
                      style={{ position: 'absolute', bottom: '16px', right: '16px' }}
                      onMouseLeave={() => setIsAvatarMenuOpen(false)}
                    >
                      <button 
                        type="button"
                        onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                        title="Edit Foto Profil"
                        style={{
                          background: '#fff', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '50%',
                          width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10
                        }}
                      >
                        <Pencil size={18} />
                      </button>
                      
                      {isAvatarMenuOpen && (
                        <div style={{
                          position: 'absolute', bottom: '110%', right: '0', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)',
                          borderRadius: '12px', padding: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: '4px',
                          minWidth: '140px', zIndex: 20
                        }}>
                          <button 
                            type="button"
                            onClick={() => {
                              fileInputRef.current?.click()
                              setIsAvatarMenuOpen(false)
                            }}
                            style={{
                              background: 'transparent', border: 'none', padding: '8px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600,
                              color: 'var(--color-text)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                            onMouseOver={(e) => e.target.style.background = 'var(--color-bg-surface)'}
                            onMouseOut={(e) => e.target.style.background = 'transparent'}
                          >
                            <Camera size={14} /> Ubah Foto
                          </button>
                          
                          {form.avatar && (
                            <button 
                              type="button"
                              onClick={() => {
                                setForm({ ...form, avatar: null })
                                setIsAvatarMenuOpen(false)
                              }}
                              style={{
                                background: 'transparent', border: 'none', padding: '8px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600,
                                color: '#ef4444', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                              }}
                              onMouseOver={(e) => e.target.style.background = '#fee2e2'}
                              onMouseOut={(e) => e.target.style.background = 'transparent'}
                            >
                              <Trash2 size={14} /> Hapus Foto
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/png, image/jpeg" style={{ display: 'none' }} />
                  </div>

                  {/* Profile Info Summary */}
                  <div style={{ textAlign: 'center', width: '100%', padding: '0 10px' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px 0', wordBreak: 'break-word', lineHeight: 1.3 }}>
                      {admin?.full_name || 'Administrator'}
                    </h3>
                    <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', margin: 0, wordBreak: 'break-word' }}>
                      {admin?.email || 'admin@siska.id'}
                    </p>
                  </div>
                </div>

                {/* Right Side: Form Inputs */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '28px', marginTop: '12px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
                      <User size={15} color="var(--color-primary)" /> Nama Lengkap Admin
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      value={form.full_name}
                      onChange={handleProfileChange}
                      required
                      placeholder="Contoh: Sanzz Administrator"
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: '12px',
                        border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                        fontSize: '14.5px', color: 'var(--color-text)', outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                    />
                    <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '6px 0 0 4px' }}>
                      Nama yang akan ditampilkan pada profil dan antarmuka sistem.
                    </p>
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
                      <Shield size={15} color="var(--color-primary)" /> Username Sistem
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={form.username}
                      onChange={handleProfileChange}
                      required
                      placeholder="Contoh: sanzz_admin"
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: '12px',
                        border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                        fontSize: '14.5px', color: 'var(--color-text)', outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                    />
                    <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '6px 0 0 4px' }}>
                      Kredensial unik yang digunakan untuk keperluan login administrator.
                    </p>
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
                      <Mail size={15} color="var(--color-primary)" /> Email Kontak Admin
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleProfileChange}
                      placeholder="admin.utama@siska.id"
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: '12px',
                        border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                        fontSize: '14.5px', color: 'var(--color-text)', outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                    />
                    <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '6px 0 0 4px' }}>
                      Data email yang disimpan sebagai kontak resmi administrator.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '16px' }}>
                <button type="submit" disabled={loading} style={{ background: 'var(--color-primary)', color: '#fff', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SECURITY & AUTHENTICATION */}
          {activeTab === 'security' && (
            <form onSubmit={handleSaveSecurity} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px', flex: 1 }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Keamanan & Autentikasi</h2>
                <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: 0 }}>Perbarui password dan tingkatkan perlindungan akun dengan fitur keamanan berlapis.</p>
              </div>

              {/* Change Password Box */}
              <div style={{ background: 'var(--color-bg-base)', padding: '24px', borderRadius: '18px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={18} color="var(--color-primary)" /> Ganti Password Admin
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Password Saat Ini</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        name="current_password"
                        value={secForm.current_password}
                        onChange={handleSecChange}
                        placeholder="Masukkan password lama..."
                        style={{
                          width: '100%', padding: '12px 42px 12px 16px', borderRadius: '12px',
                          border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                          fontSize: '14px', color: 'var(--color-text)', outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                      >
                        {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Password Baru</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        name="new_password"
                        value={secForm.new_password}
                        onChange={handleSecChange}
                        placeholder="Minimal 8 karakter..."
                        style={{
                          width: '100%', padding: '12px 42px 12px 16px', borderRadius: '12px',
                          border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                          fontSize: '14px', color: 'var(--color-text)', outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                      >
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'center' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Konfirmasi Password Baru</label>
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        name="confirm_password"
                        value={secForm.confirm_password}
                        onChange={handleSecChange}
                        placeholder="Ketik ulang password baru..."
                        style={{
                          width: '100%', padding: '12px 16px', borderRadius: '12px',
                          border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                          fontSize: '14px', color: 'var(--color-text)', outline: 'none'
                        }}
                      />
                    </div>

                    {/* Password Strength Meter */}
                    <div style={{ background: 'var(--color-bg-base)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--color-border)', marginTop: '22px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Kekuatan Password:</span>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: strength.color }}>{strength.label}</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--color-bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${strength.score}%`, height: '100%', background: strength.color, transition: 'all 0.3s' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '16px' }}>
                <button type="submit" disabled={loading} style={{ background: 'var(--color-primary)', color: '#fff', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Menyimpan...' : 'Simpan Keamanan'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SHIFT & ATTENDANCE RULES */}
          {activeTab === 'shifts' && (
            <form onSubmit={handleSaveShifts} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Pengaturan Jam Shift & Toleransi</h2>
                  <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: 0 }}>Kelola jam operasional absensi masuk dan batas toleransi keterlambatan.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddShift}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd',
                    padding: '10px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '13.5px',
                    cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(3,105,161,0.1)'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#bae6fd' }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#e0f2fe' }}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Tambah Shift Baru
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {(!shiftSettings?.shifts || shiftSettings.shifts.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '36px', background: 'var(--color-bg-base)', borderRadius: '16px', color: 'var(--color-text-secondary)', fontSize: '14px', border: '1px dashed var(--color-border)' }}>
                    Belum ada jadwal shift yang dikonfigurasi. Klik tombol <b>+ Tambah Shift Baru</b> di atas.
                  </div>
                ) : (
                  shiftSettings.shifts.map((shift, idx) => (
                    <div key={shift.id || idx} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto', gap: '16px', alignItems: 'flex-end', background: 'var(--color-bg-base)', padding: '20px', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
                          Nama & Label Shift
                        </label>
                        <input
                          type="text"
                          value={shift.name || ''}
                          onChange={(e) => handleShiftChange(idx, 'name', e.target.value)}
                          placeholder="Contoh: Shift Pagi"
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: '10px',
                            border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                            fontSize: '14px', color: 'var(--color-text)', outline: 'none'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
                          Jam Masuk
                        </label>
                        <input
                          type="time"
                          value={shift.start_time || ''}
                          onChange={(e) => handleShiftChange(idx, 'start_time', e.target.value)}
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: '10px',
                            border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                            fontSize: '14px', color: 'var(--color-text)', outline: 'none'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
                          Jam Pulang
                        </label>
                        <input
                          type="time"
                          value={shift.end_time || ''}
                          onChange={(e) => handleShiftChange(idx, 'end_time', e.target.value)}
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: '10px',
                            border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                            fontSize: '14px', color: 'var(--color-text)', outline: 'none'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
                          Toleransi Terlambat
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            value={shift.tolerance || '15'}
                            onChange={(e) => handleShiftChange(idx, 'tolerance', e.target.value)}
                            placeholder="15"
                            style={{
                              width: '100%', padding: '10px 45px 10px 14px', borderRadius: '10px',
                              border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                              fontSize: '14px', color: 'var(--color-text)', outline: 'none'
                            }}
                          />
                          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Menit</span>
                        </div>
                      </div>
                      <div style={{ paddingBottom: '2px' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteShift(idx)}
                          title="Hapus Shift"
                          style={{
                            background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca',
                            width: '42px', height: '42px', borderRadius: '10px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#dc2626' }}
                          onMouseOut={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '14px', padding: '16px', display: 'flex', gap: '14px', alignItems: 'center' }}>
                <AlertTriangle color="#f59e0b" size={22} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.5 }}>
                  <b>Informasi Toleransi Keterlambatan:</b> Jika dosen atau pegawai melakukan scan wajah/absen masuk melebihi <code>Jam Masuk + Toleransi</code> (misalnya jam 08:16 pada toleransi 15 menit), sistem akan otomatis menandai status kehadiran sebagai <b>Terlambat</b> beserta durasi keterlambatannya.
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '16px' }}>
                <button type="submit" disabled={loading} style={{ background: 'var(--color-primary)', color: '#fff', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Menyimpan...' : 'Simpan Shift'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: SYSTEM PREFERENCES & NOTIFICATIONS */}
          {activeTab === 'preferences' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px', flex: 1 }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Preferensi Sistem</h2>
                <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: 0 }}>Atur mode tampilan antarmuka sistem.</p>
              </div>

              {/* Theme Selector */}
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Monitor size={18} color="var(--color-primary)" /> Tema Tampilan Aplikasi
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {[
                    { id: 'light', label: 'Mode Terang (Light)', icon: Sun, desc: 'Tampilan bersih dengan latar cerah' },
                    { id: 'dark', label: 'Mode Gelap (Dark)', icon: Moon, desc: 'Elegan dan ramah di mata malam hari' },
                    { id: 'system', label: 'Ikuti Sistem', icon: Monitor, desc: 'Menyesuaikan dengan pengaturan OS' }
                  ].map((theme) => {
                    const selected = prefForm.theme_mode === theme.id
                    return (
                      <div
                        key={theme.id}
                        onClick={() => {
                          setPrefForm({ ...prefForm, theme_mode: theme.id })
                          localStorage.setItem('theme', theme.id)
                          window.dispatchEvent(new Event('theme-change'))
                        }}
                        style={{
                          background: selected ? 'rgba(59, 130, 246, 0.08)' : 'var(--color-bg-base)',
                          border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          borderRadius: '16px', padding: '18px', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: selected ? 'var(--color-primary)' : '#e2e8f0', color: selected ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <theme.icon size={20} />
                          </div>
                          {selected && <Check size={18} color="var(--color-primary)" strokeWidth={3} />}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>{theme.label}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{theme.desc}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Tambah Shift Baru */}
      {newShiftForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="animate-scale-in" style={{
            background: 'var(--color-bg-base)', width: '100%', maxWidth: '450px',
            borderRadius: '20px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            border: '1px solid var(--color-border)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px 0' }}>Tambah Shift Baru</h3>
            <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: '0 0 24px 0' }}>Lengkapi rincian waktu untuk shift absensi yang baru.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>Nama & Label Shift</label>
                <input type="text" value={newShiftForm.name} onChange={e => setNewShiftForm({...newShiftForm, name: e.target.value})} placeholder="Contoh: Shift Pagi Tambahan" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', fontSize: '14.5px', color: 'var(--color-text)', outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>Jam Masuk</label>
                  <input type="time" value={newShiftForm.start_time} onChange={e => setNewShiftForm({...newShiftForm, start_time: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', fontSize: '14.5px', color: 'var(--color-text)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>Jam Keluar</label>
                  <input type="time" value={newShiftForm.end_time} onChange={e => setNewShiftForm({...newShiftForm, end_time: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', fontSize: '14.5px', color: 'var(--color-text)', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>Toleransi Keterlambatan (Menit)</label>
                <input type="number" min="0" max="120" value={newShiftForm.tolerance} onChange={e => setNewShiftForm({...newShiftForm, tolerance: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', fontSize: '14.5px', color: 'var(--color-text)', outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button 
                type="button" 
                onClick={() => setNewShiftForm(null)}
                style={{ background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={e => e.target.style.background = 'var(--color-bg-surface)'}
                onMouseOut={e => e.target.style.background = 'transparent'}
              >
                Batal
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const newShifts = shiftSettings?.shifts ? [...shiftSettings.shifts] : [];
                  newShifts.push({ id: Date.now(), ...newShiftForm });
                  setShiftSettings({ ...shiftSettings, shifts: newShifts });
                  setNewShiftForm(null);
                  // toast.success('Shift ditambahkan ke daftar! Jangan lupa klik Simpan Perubahan.');
                }}
                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={e => e.target.style.opacity = '0.9'}
                onMouseOut={e => e.target.style.opacity = '1'}
              >
                Tambahkan Shift
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
