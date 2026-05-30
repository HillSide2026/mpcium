import { Check, Clock, X, Loader } from 'lucide-react'
import type { TxStatus } from '@/lib/types'

const steps: { status: TxStatus; label: string; description: string }[] = [
  { status: 'signing',   label: 'MPC Signing',  description: '2-of-3 nodes computing threshold signature' },
  { status: 'signed',    label: 'Signed',        description: 'Signature assembled from shares' },
  { status: 'broadcast', label: 'Broadcast',     description: 'Transaction submitted to network' },
  { status: 'confirmed', label: 'Confirmed',     description: 'Included in a block on-chain' },
]

const ORDER: TxStatus[] = ['draft', 'signing', 'signed', 'broadcast', 'confirmed', 'failed']

function stepState(stepStatus: TxStatus, current: TxStatus): 'done' | 'active' | 'pending' | 'failed' {
  if (current === 'failed') {
    return ORDER.indexOf(stepStatus) < ORDER.indexOf(current) - 1 ? 'done' : 'failed'
  }
  const ci = ORDER.indexOf(current)
  const si = ORDER.indexOf(stepStatus)
  if (si < ci)  return 'done'
  if (si === ci) return 'active'
  return 'pending'
}

export function TxTimeline({ status }: { status: TxStatus }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const state = stepState(step.status, status)
        const isLast = i === steps.length - 1

        const dotBg =
          state === 'done'    ? '#37c0a1' :
          state === 'active'  ? '#ffffff'  :
          state === 'failed'  ? '#d0021b'  : '#ededed'

        const dotBorder =
          state === 'done'    ? '#37c0a1' :
          state === 'active'  ? '#007aff' :
          state === 'failed'  ? '#d0021b' : '#ededed'

        return (
          <li key={step.status} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all"
                style={{ background: dotBg, borderColor: dotBorder }}
              >
                {state === 'done'    && <Check   size={13} color="#fff" strokeWidth={2.5} />}
                {state === 'active'  && <Loader  size={13} color="#007aff" className="animate-spin" />}
                {state === 'pending' && <Clock   size={13} color="#ededed" />}
                {state === 'failed'  && <X       size={13} color="#fff" strokeWidth={2.5} />}
              </div>
              {!isLast && (
                <div
                  className="w-0.5 h-8 mt-0.5 transition-colors"
                  style={{ background: state === 'done' ? '#d2f8d6' : '#ededed' }}
                />
              )}
            </div>
            <div className="pb-8">
              <p
                className="text-sm font-semibold"
                style={{ color: state === 'pending' ? '#ededed' : '#0c2550' }}
              >
                {step.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#9aa0aa' }}>
                {step.description}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
