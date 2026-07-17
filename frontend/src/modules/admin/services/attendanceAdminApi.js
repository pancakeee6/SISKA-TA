import api from '@shared/services/api'

const attendanceAdminApi = {
  /**
   * Get attendance logs with pagination and filters.
   * @param {{ page?: number, per_page?: number, date?: string, search?: string }} params
   */
  getLogs: (params = {}) => api.get('/api/v1/attendance/logs', { params }),

  /**
   * Export attendance data.
   * @param {{ date_from?: string, date_to?: string }} params
   */
  export: (params = {}) => api.get('/api/v1/attendance/export', { params, responseType: 'blob' }),

  /**
   * Record out-of-town official duty (Dinas Luar Kota).
   * @param {{ user_id: string, date?: string, keterangan?: string }} data
   */
  recordDinas: (data) => api.post('/api/v1/attendance/dinas', data),
}

export default attendanceAdminApi
