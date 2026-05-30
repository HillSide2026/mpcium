'use client'

import { useEffect, useState } from 'react'
import { Check, Loader } from 'lucide-react'

type NodeState = 'idle' | 'generating' | 'done'

const STEPS = [
  { at: 0,    node: -1, message: 'Connecting to signing cluster…' },
  { at: 1500, node: 0,  message: 'Node 1 generating key share…' },
  { at: 3500, node: 1,  message: 'Node 2 generating key share…' },
  { at: 5500, node: 2,  message: 'Node 3 generating key share…' },
  { at: 7500, node: -1, message: 'Distributing shares…' },
]

export function KeygenCeremony({
  active,
  done,
}: {
  active: boolean
  done: boolean
}) {
  const [nodes, setNodes] = useState<NodeState[]>(['idle', 'idle', 'idle'])
  const [step, setStep]   = useState(0)

  useEffect(() => {
    if (!active) return
    setNodes(['idle', 'idle', 'idle'])
    setStep(0)
    const timers: ReturnType<typeof setTimeout>[] = []

    // Node 0 starts generating
    timers.push(setTimeout(() => {
      setStep(1)
      setNodes(['generating', 'idle', 'idle'])
    }, 1500))
    // Node 0 done, Node 1 starts
    timers.push(setTimeout(() => {
      setStep(2)
      setNodes(['done', 'generating', 'idle'])
    }, 3500))
    // Node 1 done, Node 2 starts
    timers.push(setTimeout(() => {
      setStep(3)
      setNodes(['done', 'done', 'generating'])
    }, 5500))
    // All done
    timers.push(setTimeout(() => {
      setStep(4)
      setNodes(['done', 'done', 'done'])
    }, 7500))

    return () => timers.forEach(clearTimeout)
  }, [active])

  if (!active && !done) return null

  const message = done
    ? '✓ Your key is split across 3 nodes. No single node can sign alone.'
    : STEPS[step]?.message ?? 'Processing…'

  return (
    <div className="space-y-5">
      {/* Node diagram */}
      <div className="flex items-center justify-center gap-3">
        {[0, 1, 2].map((i) => {
          const state = done ? 'done' : nodes[i]
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500"
                style={{
                  borderColor:
                    state === 'done'       ? '#37c0a1' :
                    state === 'generating' ? '#007aff' : '#ededed',
                  background:
                    state === 'done'       ? '#d2f8d6' :
                    state === 'generating' ? '#ccddf9' : '#f5f5f5',
                  transform: state === 'generating' ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: state === 'generating' ? '0 0 0 3px #007aff33' : 'none',
                }}
              >
                {state === 'done' && <Check size={20} color="#37c0a1" strokeWidth={2.5} />}
                {state === 'generating' && <Loader size={18} color="#007aff" className="animate-spin" />}
                {state === 'idle' && <span className="text-xs font-bold text-[#9aa0aa]">{i + 1}</span>}
              </div>
              <span className="text-[#9aa0aa] text-xs">node {i}</span>
              {/* Connector line (between nodes) */}
              {i < 2 && (
                <div className="absolute" /> /* spacer handled by gap */
              )}
            </div>
          )
        })}
      </div>

      {/* Connecting lines between nodes */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center">
              <div
                className="h-0.5 w-10 transition-all duration-500"
                style={{
                  background: (done || nodes[i] === 'done')
                    ? 'linear-gradient(90deg, #37c0a1, #37c0a1)'
                    : '#ededed',
                }}
              />
              <div
                className="h-0.5 w-10 transition-all duration-500"
                style={{
                  background: (done || nodes[i + 1] === 'done' || nodes[i + 1] === 'generating')
                    ? 'linear-gradient(90deg, #37c0a1, #ededed)'
                    : '#ededed',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Status message */}
      <p
        className="text-center text-sm font-medium transition-all duration-300"
        style={{ color: done ? '#37c0a1' : '#0c2550' }}
      >
        {message}
      </p>

      {done && (
        <div className="bg-[#d2f8d6] rounded-xl px-4 py-3 text-center">
          <p className="text-[#0c2550] text-xs leading-relaxed">
            2-of-3 nodes must cooperate to sign any transaction.{' '}
            <strong>Your private key is never assembled in one place.</strong>
          </p>
        </div>
      )}
    </div>
  )
}
