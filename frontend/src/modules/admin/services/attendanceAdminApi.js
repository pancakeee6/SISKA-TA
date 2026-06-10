import api from '@shared/services/api'

const attendanceAdminApi = {
  /**
   * Get attendance logs with pagination and filters.
   * ML API uses /admin/events. We map the frontend pagination to ML API limit/offset.
   * @param {{ page?: number, per_page?: number, date?: string, search?: string }} params
   */
  getLogs: async (params = {}) => {
    const limit = params.per_page || 20
    const offset = ((params.page || 1) - 1) * limit
    
    // Convert to ML API format
    const mlParams = {
      limit,
      offset,
      day: params.date,
      name: params.search
    }
    
    const res = await api.get('/admin/events', { params: mlParams })
    
    // ML API returns an array directly, frontend expects { data: { items, total } }
    // Since ML API doesn't return total count easily without fetching all, we fake total = offset + limit + 1 if more data exists
    const items = res.data.map(r => ({
      id: r.id,
      timestamp: r.ts,
      status: r.is_late ? "late" : "present",
      late: r.is_late,
      user: { full_name: r.final_name || r.predicted_name || 'Unknown' }
    }))
    
    return { data: { items, total: items.length >= limit ? offset + limit + 10 : offset + items.length } }
  },

  /**
   * Export attendance data.
   * @param {{ date_from?: string, date_to?: string }} params
   */
  export: (params = {}) => {
    // ML API exports by month or day. If date_from is given, extract month
    const month = params.date_from ? params.date_from.substring(0, 7) : undefined
    return api.get('/admin/reports/export/csv', { params: { month }, responseType: 'blob' })
  },
}

export default attendanceAdminApi
