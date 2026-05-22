import { create } from 'zustand'

export const useAttendanceStore = create((set) => ({
  // Realtime attendance events from WebSocket
  recentEvents: [],
  todayStats: {
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
  },

  // Actions
  addEvent: (event) => {
    set((state) => ({
      recentEvents: [event, ...state.recentEvents].slice(0, 50), // keep last 50
    }))
  },

  setTodayStats: (stats) => {
    set({ todayStats: stats })
  },

  clearEvents: () => {
    set({ recentEvents: [] })
  },
}))
