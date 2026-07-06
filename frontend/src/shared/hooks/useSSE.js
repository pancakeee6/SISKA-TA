import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for Server-Sent Events (SSE) connection.
 * Connects to the attendance stream and receives realtime events.
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Whether to connect
 * @param {function} options.onMessage - Callback when message is received
 * @returns {{ isConnected: boolean }}
 */
export default function useSSE({ enabled = true, onMessage } = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef(null)
  const onMessageRef = useRef(onMessage)

  // Keep onMessage ref updated without re-triggering effect
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    // If already connected, do nothing
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return

    // Build SSE URL from current location (will be proxy'd via Vite during dev)
    const protocol = window.location.protocol
    const sseUrl = `${protocol}//${window.location.host}/stream/attendance`

    try {
      const eventSource = new EventSource(sseUrl)

      eventSource.onopen = () => {
        setIsConnected(true)
        console.log('[SSE] Connected to attendance stream')
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessageRef.current?.(data)
        } catch (e) {
          console.warn('[SSE] Failed to parse message:', e)
        }
      }

      eventSource.onerror = (error) => {
        setIsConnected(false)
        console.warn('[SSE] Connection error/disconnected:', error)
        // Note: EventSource automatically reconnects, we don't need manual logic here!
      }

      eventSourceRef.current = eventSource
    } catch (e) {
      console.error('[SSE] Setup error:', e)
    }
  }, [])

  // Connect/disconnect based on enabled flag
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setIsConnected(false)
      }
    }
  }, [enabled, connect])

  return { isConnected }
}
