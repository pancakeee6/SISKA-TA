import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'

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

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-[var(--color-bg)]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-[var(--color-text-secondary)]">Memuat...</p>
    </div>
  </div>
)

export default function App() {
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
