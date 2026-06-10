import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for WebSocket connection with auto-reconnect.
 * Connects to the attendance WebSocket and receives realtime events.
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Whether to connect
 * @param {function} options.onMessage - Callback when message is received
 * @returns {{ isConnected: boolean, reconnectCount: number }}
 */
export default function useWebSocket({ enabled = true, onMessage } = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectCount, setReconnectCount] = useState(0)
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const onMessageRef = useRef(onMessage)

  // Keep onMessage ref updated without re-triggering effect
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Build WS URL from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/attendance`

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setIsConnected(true)
        setReconnectCount(0)
        console.log('[WS] Connected to attendance stream')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessageRef.current?.(data)
        } catch (e) {
          console.warn('[WS] Failed to parse message:', e)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null

        // Auto-reconnect with exponential backoff (max 30s)
        if (enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000)
          console.log(`[WS] Disconnected. Reconnecting in ${delay / 1000}s...`)
          reconnectTimerRef.current = setTimeout(() => {
            setReconnectCount((c) => c + 1)
            // eslint-disable-next-line
            connect()
          }, delay)
        }
      }

      ws.onerror = () => {
        // onclose will fire after this
      }

      wsRef.current = ws
    } catch (e) {
      console.error('[WS] Connection error:', e)
    }
  }, [enabled, reconnectCount])

  // Connect/disconnect based on enabled flag
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return { isConnected, reconnectCount }
}
