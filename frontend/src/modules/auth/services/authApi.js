import api from '@shared/services/api'

const authApi = {
  /**
   * Login admin with username and password.
   * @param {{ username: string, password: string }} credentials
   * @returns {Promise<{ access_token: string, token_type: string }>}
   */
  login: (credentials) => api.post('/admin/login', credentials),

  /**
   * Get current admin info from JWT (Not available in ML API, mock it)
   * @returns {Promise<{ id: string, username: string, full_name: string }>}
   */
  getMe: async () => {
    return { data: { id: "1", username: "admin", full_name: "Administrator" } }
  },
}

export default authApi
