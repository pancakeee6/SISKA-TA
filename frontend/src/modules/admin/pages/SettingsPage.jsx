import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@shared/store/authStore'
import { 
  Save, User, Lock, Shield, Camera, Clock, Plus, Trash2, Bell, 
  Smartphone, Mail, CheckCircle2, AlertTriangle, Key, Sliders, 
  Moon, Sun, Monitor, Activity, Eye, EyeOff, Check, ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@shared/services/api'

export default function SettingsPage() {
  const { admin, setAdmin } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile') // profile | security | shifts | preferences
  const [shiftSettings, setShiftSettings] = useState(null)
  const fileInputRef = useRef(null)

  // Profile Form state
  const [form, setForm] = useState({
    full_name: admin?.full_name || '',
    username: admin?.username || '',
    email: localStorage.getItem('admin_email') || 'admin.utama@siska.id',
    phone: localStorage.getItem('admin_phone') || '+62 812-3456-7890',
    avatar: admin?.avatar || null,
  })

  // Security Form state
  const [secForm, setSecForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
    two_factor: localStorage.getItem('admin_2fa') === 'true',
    session_timeout: localStorage.getItem('admin_timeout') || '60',
  })
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)

  // Preferences Form state
  const [prefForm, setPrefForm] = useState({
    sound_notify: localStorage.getItem('pref_sound') !== 'false',
    late_alert: localStorage.getItem('pref_late_alert') !== 'false',
    daily_report: localStorage.getItem('pref_daily_report') === 'true',
    theme_mode: localStorage.getItem('theme') || 'light',
  })

  useEffect(() => {
    // Sync admin info when auth store changes
    if (admin) {
      setForm(prev => ({
        ...prev,
        full_name: admin.full_name || prev.full_name,
        username: admin.username || prev.username,
        avatar: admin.avatar || prev.avatar,
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
    const newShifts = shiftSettings?.shifts ? [...shiftSettings.shifts] : []
    const nextNum = newShifts.length + 1
    newShifts.push({
      id: Date.now(),
      name: `Shift ${nextNum} (Tambahan)`,
      start_time: '08:00',
      end_time: '16:00',
      tolerance: '15'
    })
    setShiftSettings({ shifts: newShifts })
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

  const handleSaveAll = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Validate password if user attempts to change it
      if (secForm.new_password || secForm.current_password) {
        if (!secForm.current_password) {
          toast.error('Masukkan password saat ini untuk mengubah password baru.')
          setLoading(false)
          return
        }
        if (secForm.new_password !== secForm.confirm_password) {
          toast.error('Password baru dan konfirmasi password tidak cocok!')
          setLoading(false)
          return
        }
        if (secForm.new_password.length < 6) {
          toast.error('Password baru minimal 6 karakter.')
          setLoading(false)
          return
        }
      }

      // 2. Save profile API
      const payload = {
        full_name: form.full_name,
        username: form.username,
        avatar: form.avatar,
      }
      if (secForm.current_password && secForm.new_password) {
        payload.current_password = secForm.current_password
        payload.new_password = secForm.new_password
      }

      const { data } = await api.put('/api/v1/auth/me', payload)
      setAdmin(data.admin)

      // 3. Save shifts API
      if (shiftSettings) {
        await api.put('/api/v1/settings/shifts', shiftSettings)
      }

      // 4. Save local preferences & security metadata
      localStorage.setItem('admin_email', form.email)
      localStorage.setItem('admin_phone', form.phone)
      localStorage.setItem('admin_2fa', secForm.two_factor)
      localStorage.setItem('admin_timeout', secForm.session_timeout)
      localStorage.setItem('pref_sound', prefForm.sound_notify)
      localStorage.setItem('pref_late_alert', prefForm.late_alert)
      localStorage.setItem('pref_daily_report', prefForm.daily_report)
      
      if (prefForm.theme_mode !== localStorage.getItem('theme')) {
        localStorage.setItem('theme', prefForm.theme_mode)
        document.documentElement.setAttribute('data-theme', prefForm.theme_mode)
      }

      toast.success('Pengaturan profil dan sistem berhasil diperbarui secara menyeluruh!')
      
      // Clear password form
      setSecForm(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }))
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan pengaturan profil')
    } finally {
      setLoading(false)
    }
  }

  const strength = getPasswordStrength(secForm.new_password)

  const tabs = [
    { id: 'profile', label: 'Profil & Akun', icon: User, desc: 'Identitas & kontak admin' },
    { id: 'security', label: 'Keamanan Akses', icon: Shield, desc: 'Password & autentikasi 2FA' },
    { id: 'shifts', label: 'Jam Shift & Toleransi', icon: Clock, desc: 'Aturan & jam kerja absensi' },
    { id: 'preferences', label: 'Preferensi & Notifikasi', icon: Sliders, desc: 'Tampilan & peringatan sistem' },
  ]

  return (
    <div style={{ maxWidth: '1160px', margin: '0 auto', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 40px)' }} className="animate-fade-in">
      
      {/* 1. HERO HEADER WITH PROFILE OVERVIEW CARD */}
      <div style={{ 
        background: 'var(--color-bg-surface)', 
        border: '1px solid var(--color-border)', 
        borderRadius: '24px', 
        padding: '28px 32px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '24px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
          {/* Avatar Hero */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '84px', height: '84px', borderRadius: '24px',
              border: '3px solid var(--color-primary)', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', overflow: 'hidden', background: 'var(--color-bg-base)',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.15)'
            }}>
              {form.avatar ? (
                <img src={form.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={42} color="var(--color-primary)" />
              )}
            </div>
            <span style={{
              position: 'absolute', bottom: '-4px', right: '-4px',
              background: '#10b981', color: '#fff', fontSize: '10px', fontWeight: 800,
              padding: '3px 8px', borderRadius: '12px', border: '2px solid var(--color-bg-surface)',
              display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }}></span>
              AKTIF
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                {form.full_name || 'Administrator Utama'}
              </h1>
              <span style={{ 
                background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', 
                fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px' 
              }}>
                Super Admin
              </span>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>@{form.username || 'admin'}</span> • <span>{form.email}</span>
            </p>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle2 size={15} color="#10b981" /> Sesi Enkripsi 256-bit
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={15} color="#6366f1" /> Login terakhir: Hari ini
              </span>
            </div>
          </div>
        </div>

        {/* Quick Summary Badges */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          {[
            { label: 'Shift Terdaftar', val: `${shiftSettings?.shifts?.length || 2} Shift`, icon: Clock, color: '#4f46e5', bg: 'rgba(99, 102, 241, 0.1)' },
            { label: 'Otentikasi 2FA', val: secForm.two_factor ? 'Aktif' : 'Non-Aktif', icon: Key, color: secForm.two_factor ? '#10b981' : '#f59e0b', bg: secForm.two_factor ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' },
            { label: 'Notifikasi Suara', val: prefForm.sound_notify ? 'Nyala' : 'Senyap', icon: Bell, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }
          ].map((item, idx) => (
            <div key={idx} style={{ 
              background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', 
              borderRadius: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
              minWidth: '140px'
            }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <item.icon size={20} strokeWidth={2.5} />
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0, fontWeight: 600 }}>{item.label}</p>
                <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{item.val}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. MAIN SETTINGS GRID (SIDEBAR TABS + CONTENT FORM) */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'flex-start', flex: 1, minHeight: 0 }}>
        
        {/* Left Tab Navigation */}
        <div style={{ 
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', 
          borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
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

          <hr style={{ border: 'none', borderBottom: '1px solid var(--color-border)', margin: '8px 0' }} />

          {/* Master Save Button inside Sidebar for instant access */}

        </div>

        {/* Right Content Panel */}
        <form onSubmit={handleSaveAll} style={{ 
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', 
          borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          height: '100%', overflowY: 'auto'
        }} className="no-scrollbar">

          {/* TAB 1: PROFILE & CONTACT */}
          {activeTab === 'profile' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Informasi Pribadi & Kontak</h2>
                <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: 0 }}>Atur identitas resmi dan saluran komunikasi administrator sistem.</p>
              </div>

              {/* Avatar Upload Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', background: 'var(--color-bg-base)', padding: '20px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: '90px', height: '90px', borderRadius: '20px',
                    border: '2px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}>
                    {form.avatar ? (
                      <img src={form.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={40} color="#94a3b8" />
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      position: 'absolute', bottom: '-6px', right: '-6px',
                      background: 'var(--color-primary)', color: '#fff', border: '2px solid var(--color-bg-surface)', borderRadius: '10px',
                      width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }}
                    title="Unggah Foto Baru"
                  >
                    <Camera size={15} />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" style={{ display: 'none' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Foto Profil Admin</h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                    Disarankan foto beresolusi minimal 200x200px dengan format PNG atau JPG. Ukuran maksimal 2MB.
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '6px 14px', borderRadius: '8px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }}
                    >
                      Pilih Foto Baru...
                    </button>
                    {form.avatar && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, avatar: null })}
                        style={{ padding: '6px 14px', borderRadius: '8px', background: '#fee2e2', border: '1px solid #fecaca', fontSize: '12.5px', fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
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
                      fontSize: '14.5px', color: 'var(--color-text)', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
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
                      fontSize: '14.5px', color: 'var(--color-text)', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
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
                      fontSize: '14.5px', color: 'var(--color-text)', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
                    <Smartphone size={15} color="var(--color-primary)" /> Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleProfileChange}
                    placeholder="+62 812-xxxx-xxxx"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                      fontSize: '14.5px', color: 'var(--color-text)', outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Role Info Note */}
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '14px', padding: '16px', display: 'flex', gap: '14px', alignItems: 'center' }}>
                <CheckCircle2 color="var(--color-primary)" size={24} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.5 }}>
                  <b>Hak Akses Penuh:</b> Akun ini dikonfigurasi sebagai <code>Super Administrator</code>. Anda dapat mengelola seluruh data dosen, mahasiswa, shift, ekspor laporan, dan kredensial sistem tanpa pembatas.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY & AUTHENTICATION */}
          {activeTab === 'security' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
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

              {/* Extra Security Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderRadius: '16px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Autentikasi Dua Langkah (2FA)</h4>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Tambahkan kode verifikasi ekstra via email atau aplikasi authenticator saat login.</p>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '52px', height: '28px', cursor: 'pointer' }}>
                    <input type="checkbox" name="two_factor" checked={secForm.two_factor} onChange={handleSecChange} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute', inset: 0, borderRadius: '28px',
                      background: secForm.two_factor ? 'var(--color-primary)' : '#cbd5e1', transition: '0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '22px', width: '22px', left: secForm.two_factor ? '26px' : '3px', bottom: '3px',
                        background: 'white', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderRadius: '16px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Batas Waktu Sesi Tidak Aktif (Session Timeout)</h4>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Sistem akan otomatis log out jika tidak ada aktivitas dalam durasi yang dipilih.</p>
                  </div>
                  <select
                    name="session_timeout"
                    value={secForm.session_timeout}
                    onChange={handleSecChange}
                    style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="30" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text)' }}>30 Menit</option>
                    <option value="60" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text)' }}>1 Jam (Rekomendasi)</option>
                    <option value="240" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text)' }}>4 Jam</option>
                    <option value="480" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text)' }}>8 Jam</option>
                    <option value="0" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text)' }}>Selalu Aktif (Tidak Disarankan)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHIFT & ATTENDANCE RULES */}
          {activeTab === 'shifts' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
            </div>
          )}

          {/* TAB 4: SYSTEM PREFERENCES & NOTIFICATIONS */}
          {activeTab === 'preferences' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Preferensi Sistem & Notifikasi</h2>
                <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: 0 }}>Atur mode tampilan antarmuka serta otomatisasi peringatan kehadiran.</p>
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

              {/* Notification Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: '8px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} color="var(--color-primary)" /> Otomatisasi & Peringatan
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderRadius: '16px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Notifikasi Popup & Suara Real-Time</h4>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Tampilkan indikator popup tunggal saat dosen atau pegawai berhasil melakukan absen masuk/pulang.</p>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '52px', height: '28px', cursor: 'pointer' }}>
                    <input type="checkbox" name="sound_notify" checked={prefForm.sound_notify} onChange={handlePrefChange} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute', inset: 0, borderRadius: '28px',
                      background: prefForm.sound_notify ? 'var(--color-primary)' : '#cbd5e1', transition: '0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '22px', width: '22px', left: prefForm.sound_notify ? '26px' : '3px', bottom: '3px',
                        background: 'white', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderRadius: '16px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Peringatan Otomatis Keterlambatan</h4>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Sorot warna merah/kuning muda pada dasbor saat ada keterlambatan di atas batas toleransi.</p>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '52px', height: '28px', cursor: 'pointer' }}>
                    <input type="checkbox" name="late_alert" checked={prefForm.late_alert} onChange={handlePrefChange} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute', inset: 0, borderRadius: '28px',
                      background: prefForm.late_alert ? 'var(--color-primary)' : '#cbd5e1', transition: '0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '22px', width: '22px', left: prefForm.late_alert ? '26px' : '3px', bottom: '3px',
                        background: 'white', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderRadius: '16px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Rekap Laporan Harian Otomatis</h4>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Siapkan rangkuman absensi shift pagi & sore dalam bentuk berkas siap unduh setiap akhir hari.</p>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '52px', height: '28px', cursor: 'pointer' }}>
                    <input type="checkbox" name="daily_report" checked={prefForm.daily_report} onChange={handlePrefChange} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute', inset: 0, borderRadius: '28px',
                      background: prefForm.daily_report ? 'var(--color-primary)' : '#cbd5e1', transition: '0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '22px', width: '22px', left: prefForm.daily_report ? '26px' : '3px', bottom: '3px',
                        background: 'white', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* Bottom Action Bar */}
          <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              💡 Perubahan pada tab ini akan diterapkan ke seluruh sistem SISKA setelah Anda menyimpan.
            </span>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'var(--color-primary)', color: '#ffffff',
                padding: '14px 28px', borderRadius: '14px',
                border: 'none', fontWeight: 700, fontSize: '15px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)'
              }}
              onMouseOver={(e) => { if(!loading) e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseOut={(e) => { if(!loading) e.currentTarget.style.filter = 'none' }}
            >
              {loading ? (
                <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Save size={18} strokeWidth={2.5} />
              )}
              {loading ? 'Menyimpan Perubahan...' : 'Simpan Semua Pengaturan'}
            </button>
          </div>

        </form>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
