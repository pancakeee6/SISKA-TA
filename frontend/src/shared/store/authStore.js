import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  // State
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  admin: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),

  // Actions
  setTokens: (accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem('accessToken', accessToken)
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
    set({
      accessToken,
      refreshToken,
      isAuthenticated: !!accessToken,
    })
  },

  setAccessToken: (accessToken) => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken)
    } else {
      localStorage.removeItem('accessToken')
    }
    set({ accessToken, isAuthenticated: !!accessToken })
  },

  setAdmin: (admin) => {
    set({ admin })
  },

  logout: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({
      accessToken: null,
      refreshToken: null,
      admin: null,
      isAuthenticated: false,
    })
  },
}))
