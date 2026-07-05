import api from '@shared/services/api'

const dashboardApi = {
  /**
   * Get today's attendance statistics.
   * @returns {Promise<{ total: number, present: number, late: number, absent: number }>}
   */
  getStats: () => api.get('/api/v1/dashboard/stats'),

  /**
   * Get weekly attendance statistics.
   * @returns {Promise<Array<{ day: string, present: number, late: number, absent: number }>>}
   */
  getWeekly: () => api.get('/api/v1/dashboard/weekly'),

  /**
   * Get monthly attendance statistics.
   * @returns {Promise<Array<{ day: string, present: number, late: number, absent: number }>>}
   */
  getMonthly: () => api.get('/api/v1/dashboard/monthly'),
}

export default dashboardApi
