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
   * Record out-of-town official duty or permit (Perizinan).
   * @param {FormData} formData
   */
  recordDinas: (formData) => api.post('/api/v1/attendance/dinas', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
}

export default attendanceAdminApi
