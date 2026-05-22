import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@shared/store/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setAdmin } = useAuthStore()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // TODO: Replace with actual API call
      // const res = await authApi.login(form)
      // setTokens(res.data.access_token, res.data.refresh_token)
      // setAdmin(res.data.admin)

      toast.success('Login berhasil!')
      navigate('/admin')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">SISKA</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Sistem Kehadiran Admin Panel</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] p-8">
          <h2 className="text-xl font-semibold mb-6">Login Admin</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-4 py-2.5 rounded-[var(--radius)] border border-[var(--color-border)] 
                           focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent
                           transition-all text-sm"
                placeholder="Masukkan username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 rounded-[var(--radius)] border border-[var(--color-border)] 
                           focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent
                           transition-all text-sm"
                placeholder="Masukkan password"
                required
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] 
                         text-white font-medium rounded-[var(--radius)] transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
