import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@shared/store/authStore'
import authApi from './services/authApi'
import toast from 'react-hot-toast'
import { Eye, EyeOff, X } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setAdmin } = useAuthStore()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Login to get tokens
      const res = await authApi.login(form)
      const { access_token, refresh_token } = res.data
      setTokens(access_token, refresh_token)

      // Fetch admin info
      const meRes = await authApi.getMe()
      setAdmin(meRes.data)

      toast.dismiss()
      toast.success(`Selamat datang, ${meRes.data.full_name}!`)
      navigate('/admin')
    } catch (error) {
      const detail = error.response?.data?.detail
      toast.dismiss()
      toast.error(detail || 'Login gagal, cek koneksi server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      padding: '24px 4%',
      position: 'relative',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      boxSizing: 'border-box',
    }}>
      {/* Background Image Layer (Zoomed) */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(rgba(15, 23, 42, 0.25), rgba(15, 23, 42, 0.45)), url("/kampus.jpg") center/cover no-repeat',
        transform: 'scale(1.25)',
        zIndex: 1,
      }} />

      {/* Top Left Institution Logos */}
      <div style={{
        position: 'absolute',
        top: '32px',
        left: '48px',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <img src="/logo-poltek.png" alt="Poltek Logo" style={{ height: '56px', objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6))' }} />
        <img src="/logo-siska2.png?v=2" alt="SISKA Logo 2" style={{ height: '72px', objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6))' }} />
      </div>

      {/* Inline keyframes */}
      <style>{`
        .login-input:focus {
          border-color: #3b82f6 !important;
          background: #ffffff !important;
        }
        .login-btn:hover:not(:disabled) {
          background: #1d4ed8 !important;
          box-shadow: 0 6px 12px -2px rgba(37,99,235,0.3) !important;
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
      `}</style>

      {/* LOGIN FORM CARD */}
      <div style={{
        width: '360px',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 32px',
        background: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 15px rgba(0,0,0,0.1)',
        position: 'relative',
        zIndex: 3,
      }}>
        <div style={{ margin: '0 auto', width: '100%' }}>
          {/* Header & Logo */}
          <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <img src="/logo-siska.png?v=2" alt="SISKA Logo" style={{ height: '64px', marginBottom: '16px', objectFit: 'contain' }} />
            <h2 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#1e293b',
              margin: '0 0 4px 0',
            }}>
              Masuk ke Dashboard Admin
            </h2>
            <p style={{
              fontSize: '11px',
              color: '#64748b',
              margin: 0,
            }}>
              Kelola data absensi
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="login-username" style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}>
                Username / Email
              </label>
              <input
                id="login-username"
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="login-input"
                placeholder="admin"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  color: '#1e293b',
                  fontSize: '12px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="login-password" style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="login-input"
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 36px 10px 12px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    color: '#1e293b',
                    fontSize: '12px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    right: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot Password */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#334155', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                Ingat Saya
              </label>
              <a href="#" style={{ fontSize: '11px', color: '#334155', textDecoration: 'none' }}>
                Lupa Kata Sandi?
              </a>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="login-btn"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                background: '#2563eb',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2), 0 2px 4px -1px rgba(37,99,235,0.1)',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          {/* Footer */}
          <p style={{
            textAlign: 'center',
            fontSize: '10px',
            color: '#64748b',
            marginTop: '32px',
          }}>
            © 2026 SISKA. Politeknik Baja Tegal. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
