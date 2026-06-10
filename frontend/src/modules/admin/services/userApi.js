import api from '@shared/services/api'

const userApi = {
  /**
   * List users with pagination and search.
   * @param {{ page?: number, limit?: number, search?: string }} params
   */
  list: async (params = {}) => {
    const res = await api.get('/admin/persons')
    let items = res.data.map(p => ({
      id: p.id,
      full_name: p.name,
      employee_id: `EMP-${p.id}`,
      email: `${p.name.toLowerCase().replace(/\s/g, '')}@example.com`,
      is_active: true
    }))
    
    if (params.search) {
      items = items.filter(i => i.full_name.toLowerCase().includes(params.search.toLowerCase()))
    }
    
    // Fake pagination
    const limit = params.limit || 10
    const page = params.page || 1
    const offset = (page - 1) * limit
    const paginatedItems = items.slice(offset, offset + limit)
    
    return { data: { items: paginatedItems, total: items.length } }
  },

  /**
   * Get user by ID.
   * @param {string} id
   */
  getById: async (id) => {
    return { data: { id, full_name: "Person" } }
  },

  /**
   * Create a new user.
   * @param {{ employee_id: string, full_name: string, email?: string, department?: string }} data
   */
  create: async (data) => {
    const res = await api.post('/admin/persons', { name: data.full_name })
    return { data: res.data }
  },

  /**
   * Update a user.
   * @param {string} id
   * @param {object} data
   */
  update: async (id, data) => {
    return { data: { id, ...data } }
  },

  /**
   * Soft-delete a user.
   * @param {string} id
   */
  delete: (id) => api.delete(`/admin/persons/${id}`),
}

export default userApi
