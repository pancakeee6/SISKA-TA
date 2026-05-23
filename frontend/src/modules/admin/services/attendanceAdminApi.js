import api from '@shared/services/api'

const attendanceAdminApi = {
  /**
   * Get attendance logs with pagination and filters.
   * @param {{ page?: number, per_page?: number, date?: string, search?: string }} params
   */
  getLogs: (params = {}) => api.get('/attendance/logs', { params }),

  /**
   * Export attendance data.
   * @param {{ date_from?: string, date_to?: string }} params
   */
  export: (params = {}) => api.get('/attendance/export', { params, responseType: 'blob' }),
}

export default attendanceAdminApi
