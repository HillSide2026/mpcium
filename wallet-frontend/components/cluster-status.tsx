'use client'

import { useState } from 'react'
import { Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { useClusterHealth } from '@/hooks/use-cluster-health'

export function ClusterStatus() {
  const { data, isLoading } = useClusterHealth()
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#f5f5f5]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#ededed] animate-pulse" />
        <span className="text-[#9aa0aa] text-xs">Checking cluster…</span>
      </div>
    )
  }

  const healthy = data?.healthy ?? false
  const nodes   = data?.nodes ?? []
  const threshold = data?.threshold ?? 2
  const total     = data?.total ?? 3

  return (
    <div className="rounded-2xl overflow-hidden border border-[#ededed]">
      {/* Compact strip */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-[#f5f5f5] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Shield
            size={14}
            style={{ color: healthy ? '#37c0a1' : '#d0021b' }}
            strokeWidth={2.5}
          />
          {/* Node health dots */}
          <div className="flex items-center gap-1.5">
            {nodes.map((node) => (
              <span
                key={node.name}
                className="w-2 h-2 rounded-full transition-colors"
                style={{ background: node.status === 'online' ? '#37c0a1' : '#d0021b' }}
                title={node.name}
              />
            ))}
          </div>
          <span className="text-[#0c2550] text-xs font-semibold">
            Protected by {threshold}-of-{total} MPC
          </span>
          <span className="text-[#9aa0aa] text-xs hidden sm:inline">
            · Key never assembled · {total} nodes online
          </span>
        </div>
        <div className="text-[#9aa0aa]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded explainer */}
      {expanded && (
        <div className="px-4 py-4 bg-[#f5f5f5] border-t border-[#ededed] space-y-3">
          <p className="text-[#0c2550] text-sm font-semibold">Why MPC?</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                title: 'No single point of failure',
                body: `Your key is split across ${total} independent nodes. Compromising one node gives an attacker nothing.`,
              },
              {
                title: 'Key never assembled',
                body: `Signing happens collaboratively. The full private key is never reconstructed — not even during transactions.`,
              },
              {
                title: `${threshold}-of-${total} threshold`,
                body: `Any ${threshold} of ${total} nodes must cooperate to sign. One offline node doesn't block your funds.`,
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-3 border border-[#ededed]">
                <p className="text-[#0c2550] text-xs font-semibold mb-1">{item.title}</p>
                <p className="text-[#9aa0aa] text-xs leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          {nodes.length > 0 && (
            <div className="flex gap-2">
              {nodes.map((node) => (
                <div
                  key={node.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: node.status === 'online' ? '#d2f8d6' : '#f8d2d2',
                    color:      node.status === 'online' ? '#37c0a1' : '#d0021b',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: node.status === 'online' ? '#37c0a1' : '#d0021b' }}
                  />
                  {node.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
