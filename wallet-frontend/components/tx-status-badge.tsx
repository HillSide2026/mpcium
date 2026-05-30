import type { TxStatus } from '@/lib/types'

const cfg: Record<TxStatus, { label: string; bg: string; color: string }> = {
  draft:        { label: 'Draft',        bg: '#f5f5f5',  color: '#9aa0aa' },
  policy_check: { label: 'Policy check', bg: '#fef3c7',  color: '#d97706' },
  signing:      { label: 'Signing',      bg: '#e8efff',  color: '#2757c6' },
  signed:       { label: 'Signed',       bg: '#e8efff',  color: '#2757c6' },
  broadcast:    { label: 'Broadcast',    bg: '#ccddf9',  color: '#0f5cc0' },
  confirmed:    { label: 'Confirmed',    bg: '#d2f8d6',  color: '#37c0a1' },
  failed:       { label: 'Failed',       bg: '#f8d2d2',  color: '#d0021b' },
}

export function TxStatusBadge({ status }: { status: TxStatus }) {
  const c = cfg[status] ?? cfg.draft
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  )
}
