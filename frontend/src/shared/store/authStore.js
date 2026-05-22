import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  // State
  accessToken: null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  admin: null,
  isAuthenticated: false,

  // Actions
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('refreshToken', refreshToken)
    set({
      accessToken,
      refreshToken,
      isAuthenticated: true,
    })
  },

  setAccessToken: (accessToken) => {
    set({ accessToken })
  },

  setAdmin: (admin) => {
    set({ admin })
  },

  logout: () => {
    localStorage.removeItem('refreshToken')
    set({
      accessToken: null,
      refreshToken: null,
      admin: null,
      isAuthenticated: false,
    })
  },
}))
