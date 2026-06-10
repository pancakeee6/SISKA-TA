import api from '@shared/services/api'

const faceApi = {
  /**
   * Get all face data for a specific user.
   * (ML API doesn't expose individual faces, return mock empty array to not break UI)
   * @param {string} userId
   */
  getByUser: async (userId) => {
    return { data: [] }
  },

  /**
   * Upload face image for a user (triggers AI embedding extraction).
   * @param {string} userId
   * @param {File} file - image file
   */
  upload: (userId, file) => {
    const formData = new FormData()
    formData.append('files', file) // ML API expects 'files'
    return api.post(`/admin/persons/${userId}/enroll`, formData, {
      timeout: 30000, 
    })
  },

  /**
   * Delete face data by ID.
   * (Not supported individually by ML API, ignore)
   * @param {string} faceId
   */
  delete: async (faceId) => {
    return { data: { success: true } }
  },
}

export default faceApi
