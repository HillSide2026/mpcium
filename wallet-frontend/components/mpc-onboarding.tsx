'use client'

import { Shield, SplitSquareVertical, CheckCircle2 } from 'lucide-react'

const features = [
  {
    icon: SplitSquareVertical,
    title: 'Key split across 3 nodes',
    body: 'Your private key is divided into shares. Each node holds one fragment — never the whole key.',
  },
  {
    icon: Shield,
    title: 'No single point of failure',
    body: 'Compromising one node reveals nothing. An attacker needs 2 of 3 nodes to sign anything.',
  },
  {
    icon: CheckCircle2,
    title: '2-of-3 must cooperate',
    body: 'Every transaction requires agreement from 2 nodes. One offline node never blocks your funds.',
  },
]

export function MpcOnboarding({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-8 space-y-8 max-w-lg mx-auto">
      {/* Hero icon */}
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0f5cc0 0%, #007aff 100%)' }}
      >
        <Shield size={36} className="text-white" strokeWidth={1.5} />
      </div>

      <div className="space-y-2">
        <h2 className="text-[#0c2550] text-2xl font-bold">Your keys, split — never whole</h2>
        <p className="text-[#9aa0aa] text-sm leading-relaxed max-w-sm mx-auto">
          This wallet uses threshold cryptography. No server, no browser, no one ever holds your complete private key.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left">
        {features.map((f) => (
          <div key={f.title} className="bg-[#f5f5f5] rounded-2xl p-4 border border-[#ededed]">
            <div className="w-8 h-8 rounded-xl bg-[#ccddf9] flex items-center justify-center mb-3">
              <f.icon size={16} className="text-[#007aff]" />
            </div>
            <p className="text-[#0c2550] text-sm font-semibold mb-1">{f.title}</p>
            <p className="text-[#9aa0aa] text-xs leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onCreate}
        className="px-8 py-4 rounded-2xl text-white font-semibold text-base transition-all duration-150 active:scale-[0.97] shadow-md"
        style={{ background: 'linear-gradient(135deg, #0f5cc0 0%, #007aff 100%)' }}
      >
        Create your first wallet
      </button>

      <p className="text-[#9aa0aa] text-xs">
        Secured by{' '}
        <span className="font-semibold text-[#0c2550]">2-of-3 threshold signatures</span>
        {' '}· No seed phrase · No single server risk
      </p>
    </div>
  )
}
