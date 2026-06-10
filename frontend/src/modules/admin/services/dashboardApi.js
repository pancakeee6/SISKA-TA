import api from '@shared/services/api'

const dashboardApi = {
  /**
   * Get today's attendance statistics.
   * @returns {Promise<{ data: { total: number, present: number, late: number, absent: number } }>}
   */
  getStats: async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local time
      const [dailyRes, personsRes] = await Promise.all([
        api.get('/admin/daily', { params: { day: today, limit: 1000 } }),
        api.get('/admin/persons')
      ])
      
      const present = dailyRes.data.length
      const late = dailyRes.data.filter(d => d.in_is_late).length
      const total = personsRes.data.length
      
      return { data: { total, present, late, absent: Math.max(0, total - present) } }
    } catch (err) {
      console.error(err)
      return { data: { total: 0, present: 0, late: 0, absent: 0 } }
    }
  },

  /**
   * Get weekly attendance statistics (mock for now, or calculate if needed).
   */
  getWeekly: async () => {
    return { data: [] } // Can be implemented by fetching last 7 days of /admin/daily
  },
}

export default dashboardApi
