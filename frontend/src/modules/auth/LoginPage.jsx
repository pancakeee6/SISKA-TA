import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@shared/store/authStore'
import authApi from './services/authApi'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import siskaMascot from '@/assets/siska-mascot.png'

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

      toast.success(`Selamat datang, ${meRes.data.full_name}!`)
      navigate('/admin')
    } catch (error) {
      const detail = error.response?.data?.detail
      toast.error(detail || 'Login gagal, cek koneksi server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#080e1e',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Inline keyframes */}
      <style>{`
        @keyframes loginFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes loginPulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes loginFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginParticle {
          0% { opacity: 0; transform: translateY(0) scale(0); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-60px) scale(1); }
        }
        .login-input:focus {
          border-color: rgba(56, 189, 248, 0.4) !important;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.08);
        }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover, 
        .login-input:-webkit-autofill:focus, 
        .login-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #0c1426 inset !important;
          -webkit-text-fill-color: #e2e8f0 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .login-btn:hover:not(:disabled) {
          box-shadow: 0 6px 25px rgba(56, 189, 248, 0.4) !important;
          transform: translateY(-1px);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
      `}</style>

      {/* LEFT SIDE — Branding */}
      <div style={{
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(11, 22, 40, 0.88) 0%, rgba(13, 31, 60, 0.92) 40%, rgba(9, 20, 40, 0.95) 100%), url("/kampus.jpg") center/cover no-repeat',
        padding: '40px 50px',
      }}>
        {/* Decorative glowing orbs */}
        <div style={{
          position: 'absolute',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)',
          top: '-80px',
          right: '-60px',
          animation: 'loginPulseGlow 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          width: '250px',
          height: '250px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
          bottom: '5%',
          left: '-40px',
          animation: 'loginPulseGlow 8s ease-in-out infinite',
          animationDelay: '2s',
        }} />
        <div style={{
          position: 'absolute',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'loginPulseGlow 7s ease-in-out infinite',
          animationDelay: '4s',
        }} />

        {/* Tiny star dots */}
        {[
          { top: '10%', left: '15%', size: 3, delay: '0s' },
          { top: '20%', left: '75%', size: 2, delay: '1s' },
          { top: '55%', left: '8%', size: 2, delay: '2s' },
          { top: '80%', left: '85%', size: 3, delay: '0.5s' },
          { top: '35%', left: '90%', size: 2, delay: '3s' },
          { top: '90%', left: '25%', size: 2, delay: '1.5s' },
          { top: '12%', left: '55%', size: 3, delay: '2.5s' },
          { top: '70%', left: '45%', size: 2, delay: '4s' },
          { top: '45%', left: '20%', size: 2, delay: '0.8s' },
          { top: '30%', left: '60%', size: 3, delay: '3.5s' },
        ].map((star, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            borderRadius: '50%',
            background: '#38bdf8',
            animation: `loginPulseGlow 3s ease-in-out infinite`,
            animationDelay: star.delay,
          }} />
        ))}

        {/* Horizontal layout: Mascot left + Text right */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: '40px',
          maxWidth: '620px',
        }}>
          {/* Mascot — large, on the left */}
          <div style={{
            flexShrink: 0,
            animation: 'loginFloat 5s ease-in-out infinite',
            position: 'relative',
          }}>
            {/* Glow behind mascot */}
            <div style={{
              position: 'absolute',
              bottom: '-15px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '240px',
              height: '40px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(56,189,248,0.2) 0%, transparent 70%)',
              filter: 'blur(8px)',
            }} />
            <img
              src={siskaMascot}
              alt="SISKA Mascot"
              style={{
                width: '300px',
                height: 'auto',
                filter: 'drop-shadow(0 15px 40px rgba(56,189,248,0.2))',
                position: 'relative',
                zIndex: 1,
              }}
            />
          </div>

          {/* Brand Text — beside mascot */}
          <div style={{
            animation: 'loginFadeUp 0.8s ease-out',
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              marginBottom: '16px',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>Sistem Online</span>
            </div>
            <h1 style={{
              fontSize: '42px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '4px',
              margin: '0 0 6px 0',
              textShadow: '0 2px 20px rgba(56,189,248,0.2)',
            }}>SISKA</h1>
            <p style={{
              fontSize: '15px',
              color: '#64748b',
              margin: '0 0 28px 0',
              letterSpacing: '1px',
            }}>Sistem Kehadiran AI</p>

            {/* Divider line */}
            <div style={{
              width: '50px',
              height: '3px',
              borderRadius: '2px',
              background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
              marginBottom: '24px',
            }} />

            {/* Tagline */}
            <p style={{
              fontSize: '22px',
              fontWeight: 600,
              color: '#e2e8f0',
              margin: 0,
              lineHeight: 1.5,
            }}>
              Absensi cerdas,
            </p>
            <p style={{
              fontSize: '22px',
              fontWeight: 600,
              color: '#e2e8f0',
              margin: 0,
              lineHeight: 1.5,
            }}>
              satu pandangan saja 😺
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE — Login Form */}
      <div style={{
        width: '460px',
        minWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 50px',
        background: '#0c1426',
        borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
        position: 'relative',
        zIndex: 3,
      }}>
        <div style={{ maxWidth: '340px', margin: '0 auto', width: '100%' }}>
          {/* Header */}
          <div style={{ marginBottom: '36px' }}>
            <h2 style={{
              fontSize: '26px',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 8px 0',
            }}>
              Masuk ke Admin
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              margin: 0,
            }}>
              Kelola data absensi dan manajemen wajah
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="login-username" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#94a3b8',
                marginBottom: '8px',
              }}>
                Username / Email
              </label>
              <input
                id="login-username"
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="login-input"
                placeholder="admin@siska.ai"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '28px' }}>
              <label htmlFor="login-password" style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#94a3b8',
                marginBottom: '8px',
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
                  placeholder="••••••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 44px 12px 16px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    fontSize: '14px',
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
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#38bdf8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="login-btn"
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#ffffff',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <svg style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }} viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </>
              ) : 'Masuk'}
            </button>
          </form>

          {/* Footer */}
          <p style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#475569',
            marginTop: '40px',
          }}>
            © 2026 SISKA. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
