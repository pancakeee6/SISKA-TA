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

  /**
   * Get all dashboard data in a single high-speed summary call.
   */
  getSummary: () => api.get('/api/v1/dashboard/summary'),
}

export default dashboardApi
