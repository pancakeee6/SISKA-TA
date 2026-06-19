import api from '@shared/services/api'

const userApi = {
  /**
   * List users with pagination and search.
   * @param {{ page?: number, limit?: number, search?: string }} params
   */
  list: (params = {}) => api.get('/api/v1/users/', { params }),

  /**
   * Get user by ID.
   * @param {string} id
   */
  getById: (id) => api.get(`/api/v1/users/${id}`),

  /**
   * Create a new user.
   * @param {{ employee_id: string, full_name: string, email?: string, department?: string }} data
   */
  create: (data) => api.post('/api/v1/users/', data),

  /**
   * Update a user.
   * @param {string} id
   * @param {object} data
   */
  update: (id, data) => api.put(`/api/v1/users/${id}`, data),

  /**
   * Soft-delete a user.
   * @param {string} id
   */
  delete: (id) => api.delete(`/api/v1/users/${id}`),
}

export default userApi
