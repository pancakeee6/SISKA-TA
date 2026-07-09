import axios from 'axios'
import { useAuthStore } from '@shared/store/authStore'

const api = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
})

// Request interceptor - attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle unauthorized & auto-retry transient network/server failures
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // Auto-retry GET requests up to 2 times on network drops/timeouts or temporary 5xx errors
    if (config && (config.method === 'get' || !error.response || error.response?.status >= 500) && (!config.__retryCount || config.__retryCount < 2)) {
      config.__retryCount = (config.__retryCount || 0) + 1
      const delayMs = config.__retryCount * 800
      await new Promise(resolve => setTimeout(resolve, delayMs))
      return api(config)
    }

    return Promise.reject(error)
  }
)

export default api
