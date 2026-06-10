import api from '@shared/services/api'
import axios from 'axios'

const attendanceApi = {
  /**
   * Send captured face image to backend for recognition.
   * This endpoint is PUBLIC (no auth needed) — used by kiosk device.
   * @param {Blob} imageBlob - captured face image
   * @returns {Promise<{ status: string, faces: Array }>}
   */
  recognize: (imageBlob) => {
    const formData = new FormData()
    formData.append('file', imageBlob, 'capture.jpg')

    return axios.post('/v1/recognize_multi', formData, {
      timeout: 15000,
      headers: {
        'x-device-id': 'stb-01',
        'x-device-token': '87654321'
      }
    })
  },

  /**
   * Reset attendance logs (Debug only)
   * This endpoint is PROTECTED (requires admin auth).
   * @returns {Promise}
   */
  resetLogs: () => {
    return api.post('/admin/reset_attendance')
  },
}

export default attendanceApi
