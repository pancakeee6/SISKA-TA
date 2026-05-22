import api from '@shared/services/api'

const faceApi = {
  /**
   * Get all face data for a specific user.
   * @param {string} userId
   */
  getByUser: (userId) => api.get(`/faces/users/${userId}`),

  /**
   * Upload face image for a user (triggers AI embedding extraction).
   * @param {string} userId
   * @param {File} file - image file (JPEG, PNG, WebP)
   */
  upload: (userId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/faces/users/${userId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000, // AI extraction may take time
    })
  },

  /**
   * Delete face data by ID.
   * @param {string} faceId
   */
  delete: (faceId) => api.delete(`/faces/${faceId}`),
}

export default faceApi
