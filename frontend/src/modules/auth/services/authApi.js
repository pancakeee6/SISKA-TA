import api from '@shared/services/api'

const authApi = {
  /**
   * Login admin with username and password.
   * @param {{ username: string, password: string }} credentials
   * @returns {Promise<{ access_token: string, refresh_token: string, token_type: string }>}
   */
  login: (credentials) => api.post('/auth/login', credentials),

  /**
   * Refresh access token.
   * @param {string} refreshToken
   * @returns {Promise<{ access_token: string, refresh_token: string }>}
   */
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),

  /**
   * Logout (server-side acknowledgment).
   */
  logout: () => api.post('/auth/logout'),

  /**
   * Get current admin info from JWT.
   * @returns {Promise<{ id: string, username: string, email: string, full_name: string }>}
   */
  getMe: () => api.get('/auth/me'),
}

export default authApi
