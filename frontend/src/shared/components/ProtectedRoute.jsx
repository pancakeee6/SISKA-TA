import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@shared/store/authStore'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()

  // If no auth at all, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
