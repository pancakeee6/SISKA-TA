import api from '@shared/services/api'

const faceApi = {
  /**
   * Get all face data for a specific user.
   * @param {string} userId
   */
  getByUser: (userId) => api.get(`/api/v1/faces/users/${userId}`),

  /**
   * Upload face image for a user (triggers AI embedding extraction).
   * @param {string} userId
   * @param {File} file - image file (JPEG, PNG, WebP)
   */
  upload: (userId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    // NOTE: Jangan set Content-Type manual saat pakai FormData!
    // Axios otomatis set "multipart/form-data; boundary=..." yang benar.
    // Kalau di-override manual, boundary hilang → FastAPI 422 error.
    return api.post(`/api/v1/faces/users/${userId}/upload`, formData, {
      timeout: 30000, // AI extraction may take time
    })
  },

  /**
   * Delete face data by ID.
   * @param {string} faceId
   */
  delete: (faceId) => api.delete(`/api/v1/faces/${faceId}`),

  /**
   * Set a specific face as the user's profile picture.
   * @param {string} faceId
   */
  setProfile: (faceId) => api.put(`/api/v1/faces/${faceId}/set-profile`),
}

export default faceApi
