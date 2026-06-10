import { useEffect, useState } from 'react'
import { useRive, useStateMachineInput, Layout, Fit, Alignment } from '@rive-app/react-canvas'

/**
 * AvatarAnimation - Rive animation component for attendance kiosk.
 *
 * Expected Rive file: /animations/siska_avatar.riv
 * Expected state machine: "main"
 * Expected inputs:
 *   - "state" (number): 0=idle, 1=scanning, 2=recognized, 3=unrecognized
 *
 * When the .riv file is not available, a CSS fallback animation is shown.
 *
 * @param {{ status: 'idle' | 'scanning' | 'recognized' | 'unrecognized' | 'error' | 'no_camera' }} props
 */

const STATE_MAP = {
  idle: 0,
  scanning: 1,
  recognized: 2,
  unrecognized: 3,
  error: 3,
  no_camera: 0,
}

export default function AvatarAnimation({ status = 'idle' }) {
  const [riveError, setRiveError] = useState(false)

  const { rive, RiveComponent } = useRive({
    src: '/animations/siska_avatar.riv',
    stateMachines: 'main',
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoadError: () => setRiveError(true),
  })

  // Drive the state machine input based on current status
  const stateInput = useStateMachineInput(rive, 'main', 'state')

  useEffect(() => {
    if (stateInput) {
      // eslint-disable-next-line
      stateInput.value = STATE_MAP[status] ?? 0
    }
  }, [status, stateInput])

  // Fallback when .riv file is not available yet
  if (riveError) {
    return <FallbackAnimation status={status} />
  }

  return (
    <div className="w-full h-full">
      <RiveComponent className="w-full h-full" />
    </div>
  )
}

/**
 * CSS-based fallback animation — shown when .riv file is not ready.
 * Provides a polished animated placeholder with pulsing/scanning effects.
 */
function FallbackAnimation({ status }) {
  const isScanning = status === 'scanning'
  const isRecognized = status === 'recognized'
  const isUnrecognized = status === 'unrecognized' || status === 'error'

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      {/* Outer pulse rings */}
      {isScanning && (
        <>
          <div className="absolute inset-4 rounded-full border-2 border-indigo-400/20 animate-ping" />
          <div className="absolute inset-8 rounded-full border border-indigo-400/10 animate-pulse" />
        </>
      )}

      {/* Center orb */}
      <div
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 ${
          isRecognized
            ? 'bg-gradient-to-br from-emerald-500/30 to-green-500/30 shadow-[0_0_40px_rgba(16,185,129,0.3)]'
            : isUnrecognized
              ? 'bg-gradient-to-br from-red-500/20 to-rose-500/20 shadow-[0_0_40px_rgba(239,68,68,0.2)]'
              : isScanning
                ? 'bg-gradient-to-br from-indigo-500/25 to-purple-500/25 shadow-[0_0_40px_rgba(99,102,241,0.3)] animate-pulse'
                : 'bg-gradient-to-br from-slate-700/30 to-slate-800/30'
        }`}
      >
        {/* Inner icon */}
        <span className="text-4xl">
          {isRecognized ? '✅' : isUnrecognized ? '❌' : isScanning ? '🔍' : '🤖'}
        </span>
      </div>

      {/* Status label */}
      <div className="absolute bottom-4 text-center w-full">
        <p
          className={`text-[10px] font-medium ${
            isRecognized
              ? 'text-emerald-400'
              : isUnrecognized
                ? 'text-red-400'
                : isScanning
                  ? 'text-indigo-400'
                  : 'text-slate-600'
          }`}
        >
          {isRecognized
            ? 'Dikenali'
            : isUnrecognized
              ? 'Tidak Dikenali'
              : isScanning
                ? 'Memindai...'
                : 'Siap'}
        </p>
      </div>
    </div>
  )
}
