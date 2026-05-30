'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { formatAmount } from '@/lib/utils'

export type SSEEvent = {
  type: string
  tx_hash?: string
  block_number?: number
  // Inbound transfer fields (tx_received)
  asset?: string
  raw_value?: string
  to_address?: string
  from_address?: string
}

type Listener = (event: SSEEvent) => void

type SSEContextValue = {
  subscribe: (listener: Listener) => () => void
}

const SSEContext = createContext<SSEContextValue>({ subscribe: () => () => {} })

const SSE_EVENTS = ['tx_confirmed', 'tx_received'] as const

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Set<Listener>>(new Set())

  useEffect(() => {
    const es = new EventSource('/api/events')

    function dispatch(raw: string, type: string) {
      try {
        const payload: SSEEvent = { type, ...JSON.parse(raw) }
        listenersRef.current.forEach((fn) => fn(payload))

        // Global toast for inbound transfers
        if (type === 'tx_received' && payload.asset && payload.raw_value) {
          const amount = formatAmount(payload.raw_value)
          toast.success(`Received ${amount} ${payload.asset}`, {
            description: `From ${payload.from_address?.slice(0, 14)}…`,
            duration: 8000,
          })
        }
      } catch {}
    }

    SSE_EVENTS.forEach((type) => {
      es.addEventListener(type, (e) => dispatch((e as MessageEvent).data, type))
    })

    es.onerror = () => {} // EventSource auto-reconnects

    return () => es.close()
  }, [])

  const subscribe = (listener: Listener) => {
    listenersRef.current.add(listener)
    return () => listenersRef.current.delete(listener)
  }

  return <SSEContext.Provider value={{ subscribe }}>{children}</SSEContext.Provider>
}

export function useSSE(onEvent: Listener) {
  const { subscribe } = useContext(SSEContext)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    return subscribe((ev) => onEventRef.current(ev))
  }, [subscribe])
}
