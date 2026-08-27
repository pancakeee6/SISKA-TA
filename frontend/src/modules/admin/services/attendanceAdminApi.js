import api from '@shared/services/api'

const attendanceAdminApi = {
  /**
   * Get attendance logs with pagination and filters.
   * @param {{ page?: number, per_page?: number, date?: string, search?: string }} params
   */
  getLogs: (params = {}) => api.get('/api/v1/attendance/logs', { params }),

  export: (params = {}) => api.get('/api/v1/attendance/export', { params, responseType: 'blob' }),

  /**
   * Get attendance report recap (JSON)
   * @param {{ date_from?: string, date_to?: string, user_id?: string }} params
   */
  getReportData: (params = {}) => api.get('/api/v1/attendance/report', { params }),

  /**
   * Export attendance data as Word (DOCX).
   * @param {{ date_from?: string, date_to?: string, user_id?: string }} params
   */
  exportWord: (params = {}) => api.get('/api/v1/attendance/report/word', { params, responseType: 'blob' }),

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
