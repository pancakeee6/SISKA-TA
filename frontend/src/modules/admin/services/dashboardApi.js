import api from '@shared/services/api'

const dashboardApi = {
  /**
   * Get today's attendance statistics.
   * @returns {Promise<{ total: number, present: number, late: number, absent: number }>}
   */
  getStats: () => api.get('/dashboard/stats'),

  /**
   * Get weekly attendance statistics.
   * @returns {Promise<Array<{ day: string, present: number, late: number, absent: number }>>}
   */
  getWeekly: () => api.get('/dashboard/weekly'),
}

export default dashboardApi
