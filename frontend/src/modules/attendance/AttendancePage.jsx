import { useState } from 'react'

export default function AttendancePage() {
  const [status, setStatus] = useState('idle') // idle | scanning | recognized | unrecognized

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden">
      <div className="text-center text-white">
        {/* Animation area */}
        <div className="w-64 h-64 mx-auto mb-8 rounded-full bg-gray-800 flex items-center justify-center border-2 border-gray-700">
          <p className="text-sm text-gray-400">
            {status === 'idle' && '🤖 AI Animation - Idle'}
            {status === 'scanning' && '🔍 Scanning...'}
            {status === 'recognized' && '✅ Recognized'}
            {status === 'unrecognized' && '❌ Unrecognized'}
          </p>
        </div>

        {/* Camera area */}
        <div className="w-80 h-60 mx-auto mb-6 rounded-xl bg-gray-900 border border-gray-700 flex items-center justify-center">
          <p className="text-sm text-gray-500">📷 Camera feed will appear here</p>
        </div>

        {/* Status text */}
        <h2 className="text-2xl font-bold mb-2">SISKA Attendance</h2>
        <p className="text-gray-400">Arahkan wajah Anda ke kamera</p>
      </div>
    </div>
  )
}
