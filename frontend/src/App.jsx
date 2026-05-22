import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuthStore } from '@shared/store/authStore'

// Lazy load modules for code splitting
const AttendancePage = lazy(() => import('@modules/attendance/AttendancePage'))
const LoginPage = lazy(() => import('@modules/auth/LoginPage'))
const AdminLayout = lazy(() => import('@modules/admin/AdminLayout'))
const DashboardPage = lazy(() => import('@modules/admin/pages/DashboardPage'))
const UsersPage = lazy(() => import('@modules/admin/pages/UsersPage'))
const AttendanceHistoryPage = lazy(() => import('@modules/admin/pages/AttendanceHistoryPage'))
const FaceManagementPage = lazy(() => import('@modules/admin/pages/FaceManagementPage'))

// Shared
import ProtectedRoute from '@shared/components/ProtectedRoute'

// Loading fallback (dark themed)
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-[#0f1117]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400">Memuat...</p>
    </div>
  </div>
)

export default function App() {
  const { refreshToken, setTokens, setAdmin, logout } = useAuthStore()
  const [initializing, setInitializing] = useState(!!refreshToken)

  // Auto-login: if refreshToken exists in localStorage, try to get a new access token
  useEffect(() => {
    const tryAutoLogin = async () => {
      if (!refreshToken) {
        setInitializing(false)
        return
      }
      try {
        const { default: authApi } = await import('@modules/auth/services/authApi')
        const tokenRes = await authApi.refresh(refreshToken)
        setTokens(tokenRes.data.access_token, tokenRes.data.refresh_token)

        const meRes = await authApi.getMe()
        setAdmin(meRes.data)
      } catch {
        // Refresh token invalid — clean up
        logout()
      } finally {
        setInitializing(false)
      }
    }
    tryAutoLogin()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (initializing) return <PageLoader />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="attendance" element={<AttendanceHistoryPage />} />
          <Route path="faces" element={<FaceManagementPage />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/attendance" replace />} />
      </Routes>
    </Suspense>
  )
}
