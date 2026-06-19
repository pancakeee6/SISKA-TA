import api from '@shared/services/api'

const authApi = {
  /**
   * Login admin with username and password.
   * @param {{ username: string, password: string }} credentials
   * @returns {Promise<{ access_token: string, token_type: string }>}
   */
  login: (credentials) => api.post('/api/v1/auth/login', credentials),

  /**
   * Get current admin info from JWT
   * @returns {Promise<{ id: string, username: string, full_name: string }>}
   */
  getMe: () => api.get('/api/v1/auth/me'),
}

export default authApi
