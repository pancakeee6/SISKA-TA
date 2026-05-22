import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@shared/store/authStore'
import axios from 'axios'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, accessToken, refreshToken, setTokens, setAccessToken, setAdmin, logout } = useAuthStore()
  const [checking, setChecking] = useState(!accessToken && !!refreshToken)

  useEffect(() => {
    // On page reload: accessToken is lost, but refreshToken persists in localStorage
    // Try to get a new access token using the refresh token
    if (!accessToken && refreshToken) {
      axios
        .post('/api/v1/auth/refresh', { refresh_token: refreshToken })
        .then((res) => {
          const { access_token, refresh_token } = res.data
          setTokens(access_token, refresh_token)

          // Fetch admin info
          return axios.get('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${access_token}` },
          })
        })
        .then((res) => {
          setAdmin(res.data)
        })
        .catch(() => {
          logout()
        })
        .finally(() => {
          setChecking(false)
        })
    }
  }, [])

  // Show loading while checking auth
  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f1117]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Memverifikasi sesi...</p>
        </div>
      </div>
    )
  }

  // If no auth at all, redirect to login
  if (!isAuthenticated && !refreshToken) {
    return <Navigate to="/login" replace />
  }

  return children
}
