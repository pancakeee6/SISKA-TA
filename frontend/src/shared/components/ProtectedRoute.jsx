import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@shared/store/authStore'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, refreshToken } = useAuthStore()

  // If no auth at all, redirect to login
  if (!isAuthenticated && !refreshToken) {
    return <Navigate to="/login" replace />
  }

  return children
}
