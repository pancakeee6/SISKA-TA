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

    // Use plain axios (no auth interceptor) since this is a public kiosk endpoint
    // NOTE: Do not set Content-Type manually so axios auto-generates the boundary
    return axios.post('/api/v1/attendance/recognize', formData, {
      timeout: 15000,
    })
  },
}

export default attendanceApi
