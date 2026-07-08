import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@shared/store/authStore'
import { Save, User, Lock, Shield, Camera, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@shared/services/api'

export default function SettingsPage() {
  const { admin, setAdmin } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [shiftSettings, setShiftSettings] = useState(null)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    full_name: admin?.full_name || '',
    username: admin?.username || '',
    current_password: '',
    new_password: '',
    avatar: admin?.avatar || null,
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  useEffect(() => {
    api.get('/api/v1/settings/shifts')
      .then(res => setShiftSettings(res.data))
      .catch(err => console.error("Gagal mengambil pengaturan shift", err))
  }, [])

  const handleShiftChange = (index, field, value) => {
    const newShifts = [...shiftSettings.shifts];
    newShifts[index][field] = value;
    setShiftSettings({ ...shiftSettings, shifts: newShifts });
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validasi ukuran gambar (maksimal 2MB)
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

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        full_name: form.full_name,
        username: form.username,
        avatar: form.avatar,
      }
      
      if (form.current_password && form.new_password) {
        payload.current_password = form.current_password
        payload.new_password = form.new_password
      }

      const { data } = await api.put('/api/v1/auth/me', payload)
      
      // Update store lokal
      setAdmin(data.admin)
      
      // Update shift settings
      if (shiftSettings) {
        await api.put('/api/v1/settings/shifts', shiftSettings)
      }

      toast.success('Pengaturan berhasil diperbarui!')
      
      // Kosongkan form password setelah save
      setForm(prev => ({
        ...prev,
        current_password: '',
        new_password: ''
      }))
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan profil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Pengaturan Profil</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>Kelola informasi pribadi dan keamanan akun Admin Anda.</p>
      </div>

      <div style={{ 
        background: 'var(--color-bg-surface)', 
        borderRadius: '16px', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)', 
        border: '1px solid var(--color-border)',
        overflow: 'hidden'
      }}>
        <div style={{ 
          borderBottom: '1px solid var(--color-border)', 
          padding: '16px 24px', 
          background: 'var(--color-bg-base)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px' 
        }}>
          <Shield color="var(--color-text)" size={20} />
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Informasi Admin</h2>
        </div>

        <form onSubmit={handleSave} style={{ padding: '32px 24px' }}>
          
          {/* Foto Profil Area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <div style={{
                width: '100px', height: '100px', borderRadius: '50%',
                borderColor: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', border: '4px solid #ffffff', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
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
                  position: 'absolute', bottom: 0, right: 0,
                  background: '#264b5d', color: '#fff', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#1e3a4a'}
                onMouseOut={(e) => e.currentTarget.style.background = '#264b5d'}
              >
                <Camera size={14} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Klik ikon kamera untuk mengubah foto</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Nama Lengkap */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                <User size={16} color="#94a3b8" />
                Nama Lengkap
              </label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                placeholder="Masukkan nama lengkap"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                  fontSize: '15px', color: 'var(--color-text)', outline: 'none', transition: 'all 0.2s'
                }}
                onFocus={(e) => { e.target.style.background = 'var(--color-bg-surface)'; e.target.style.borderColor = '#94a3b8'; e.target.style.boxShadow = '0 0 0 3px rgba(148,163,184,0.1)' }}
                onBlur={(e) => { e.target.style.background = 'var(--color-bg-base)'; e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
            
            {/* Username */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                <User size={16} color="#94a3b8" />
                Username
              </label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                placeholder="Masukkan username"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                  fontSize: '15px', color: 'var(--color-text)', outline: 'none', transition: 'all 0.2s'
                }}
                onFocus={(e) => { e.target.style.background = 'var(--color-bg-surface)'; e.target.style.borderColor = '#94a3b8'; e.target.style.boxShadow = '0 0 0 3px rgba(148,163,184,0.1)' }}
                onBlur={(e) => { e.target.style.background = 'var(--color-bg-base)'; e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid var(--color-border)', margin: '8px 0' }} />

            {/* Keamanan */}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#334155', margin: '0 0 16px 0' }}>Ubah Password (Opsional)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    <Lock size={14} color="#94a3b8" />
                    Password Saat Ini
                  </label>
                  <input
                    type="password"
                    name="current_password"
                    value={form.current_password}
                    onChange={handleChange}
                    placeholder="Kosongkan jika tidak diubah"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '10px',
                      border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                      fontSize: '14px', color: 'var(--color-text)', outline: 'none', transition: 'all 0.2s'
                    }}
                    onFocus={(e) => { e.target.style.background = 'var(--color-bg-surface)'; e.target.style.borderColor = '#94a3b8'; }}
                    onBlur={(e) => { e.target.style.background = 'var(--color-bg-base)'; e.target.style.borderColor = 'var(--color-border)'; }}
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    <Lock size={14} color="#94a3b8" />
                    Password Baru
                  </label>
                  <input
                    type="password"
                    name="new_password"
                    value={form.new_password}
                    onChange={handleChange}
                    placeholder="Minimal 8 karakter"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '10px',
                      border: '1px solid var(--color-border)', background: 'var(--color-bg-base)',
                      fontSize: '14px', color: 'var(--color-text)', outline: 'none', transition: 'all 0.2s'
                    }}
                    onFocus={(e) => { e.target.style.background = 'var(--color-bg-surface)'; e.target.style.borderColor = '#94a3b8'; }}
                    onBlur={(e) => { e.target.style.background = 'var(--color-bg-base)'; e.target.style.borderColor = 'var(--color-border)'; }}
                  />
                </div>
              </div>
            </div>

            {shiftSettings && (
              <>
                <hr style={{ border: 'none', borderBottom: '1px solid var(--color-border)', margin: '8px 0' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Clock size={20} color="#334155" />
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#334155', margin: 0 }}>Pengaturan Jam Shift (Batas Absen)</h3>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {shiftSettings.shifts.map((shift, idx) => (
                      <div key={shift.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                            {shift.name} - Jam Masuk (Batas Telat)
                          </label>
                          <input
                            type="time"
                            value={shift.start_time}
                            onChange={(e) => handleShiftChange(idx, 'start_time', e.target.value)}
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: '8px',
                              border: '1px solid var(--color-border)', background: '#fff',
                              fontSize: '14px', color: 'var(--color-text)', outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                            {shift.name} - Jam Berakhir
                          </label>
                          <input
                            type="time"
                            value={shift.end_time}
                            onChange={(e) => handleShiftChange(idx, 'end_time', e.target.value)}
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: '8px',
                              border: '1px solid var(--color-border)', background: '#fff',
                              fontSize: '14px', color: 'var(--color-text)', outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>

          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--color-primary)', color: '#ffffff',
                padding: '12px 24px', borderRadius: '10px',
                border: 'none', fontWeight: 600, fontSize: '15px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)'
              }}
              onMouseOver={(e) => { if(!loading) e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseOut={(e) => { if(!loading) e.currentTarget.style.filter = 'none' }}
            >
              {loading ? (
                <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Save size={18} />
              )}
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
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
