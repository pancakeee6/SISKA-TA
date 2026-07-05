import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import authApi from '@modules/auth/services/authApi'
import { useAuthStore } from '@shared/store/authStore'

// Lazy load modules for code splitting
const AttendancePage = lazy(() => import('@modules/attendance/AttendancePage'))
const LoginPage = lazy(() => import('@modules/auth/LoginPage'))
const AdminLayout = lazy(() => import('@modules/admin/AdminLayout'))
const DashboardPage = lazy(() => import('@modules/admin/pages/DashboardPage'))
const UsersPage = lazy(() => import('@modules/admin/pages/UsersPage'))
const AttendanceHistoryPage = lazy(() => import('@modules/admin/pages/AttendanceHistoryPage'))
const FaceManagementPage = lazy(() => import('@modules/admin/pages/FaceManagementPage'))
const SettingsPage = lazy(() => import('@modules/admin/pages/SettingsPage'))

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
  const { refreshToken, setAdmin } = useAuthStore()
  const [initializing, setInitializing] = useState(!!refreshToken)

  useEffect(() => {
    const initAuth = async () => {
      const state = useAuthStore.getState();
      if (state.isAuthenticated && !state.admin) {
        try {
          const { data } = await authApi.getMe();
          setAdmin(data);
        } catch (error) {
          console.error("Failed to fetch admin profile:", error);
          if (error.response?.status === 401) {
            useAuthStore.getState().logout();
          }
        }
      }
      setInitializing(false);
    };
    initAuth();
  }, [setAdmin]);

  if (initializing) return <PageLoader />

  return (
    <>
      <Toaster position="top-right" />
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
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/attendance" replace />} />
      </Routes>
    </Suspense>
    </>
  )
}
