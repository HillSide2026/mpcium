'use client'

import { useEffect, useState } from 'react'
import { Check, Loader } from 'lucide-react'

type NodeState = 'idle' | 'signing' | 'signed'

export function SigningTheater({ active, done }: { active: boolean; done: boolean }) {
  const [nodes, setNodes]   = useState<NodeState[]>(['idle', 'idle', 'idle'])
  const [count, setCount]   = useState(0)
  const [reached, setReached] = useState(false)

  useEffect(() => {
    if (!active) return
    setNodes(['idle', 'idle', 'idle'])
    setCount(0)
    setReached(false)

    const t1 = setTimeout(() => { setNodes(['signing', 'idle', 'idle']) }, 800)
    const t2 = setTimeout(() => { setNodes(['signed', 'signing', 'idle']); setCount(1) }, 2500)
    const t3 = setTimeout(() => {
      setNodes(['signed', 'signed', 'signing'])
      setCount(2)
      setReached(true) // threshold met after node2 signs
    }, 4500)
    const t4 = setTimeout(() => { setNodes(['signed', 'signed', 'signed']); setCount(3) }, 6000)

    return () => [t1, t2, t3, t4].forEach(clearTimeout)
  }, [active])

  if (!active && !done) return null

  const displayNodes = done ? (['signed', 'signed', 'signed'] as NodeState[]) : nodes
  const displayCount = done ? 3 : count
  const displayReached = done || reached

  return (
    <div className="space-y-4 py-2">
      <p className="text-center text-[#9aa0aa] text-xs uppercase tracking-wide font-medium">
        MPC Threshold Signing
      </p>

      {/* Node row with connecting lines */}
      <div className="flex items-center justify-center gap-0">
        {displayNodes.map((state, i) => (
          <div key={i} className="flex items-center">
            {/* Node circle */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-500 relative z-10"
              style={{
                borderColor:
                  state === 'signed'  ? '#37c0a1' :
                  state === 'signing' ? '#007aff' : '#ededed',
                background:
                  state === 'signed'  ? '#d2f8d6' :
                  state === 'signing' ? '#ccddf9' : '#f5f5f5',
                transform: state === 'signing' ? 'scale(1.1)' : 'scale(1)',
                boxShadow: state === 'signing' ? '0 0 0 3px #007aff22' : 'none',
              }}
            >
              {state === 'signed'  && <Check  size={18} color="#37c0a1" strokeWidth={2.5} />}
              {state === 'signing' && <Loader size={16} color="#007aff" className="animate-spin" />}
              {state === 'idle'    && <span className="text-xs font-bold text-[#9aa0aa]">{i + 1}</span>}
            </div>

            {/* Connector line */}
            {i < 2 && (
              <div
                className="h-0.5 w-8 transition-all duration-700"
                style={{
                  background: displayNodes[i] === 'signed' && displayNodes[i + 1] !== 'idle'
                    ? 'linear-gradient(90deg, #37c0a1, #007aff)'
                    : '#ededed',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Counter + status */}
      <div className="text-center space-y-1">
        <p className="text-[#0c2550] text-sm font-semibold">
          {displayCount} of 3 nodes signed
        </p>
        {displayReached && !done && (
          <p className="text-[#37c0a1] text-xs font-medium animate-pulse">
            Threshold reached · assembling signature…
          </p>
        )}
        {done && (
          <p className="text-[#37c0a1] text-xs font-medium">
            ✓ Signature complete
          </p>
        )}
      </div>
    </div>
  )
}
