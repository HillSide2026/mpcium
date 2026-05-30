'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Zap, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { TxTimeline } from '@/components/tx-timeline'
import { SigningTheater } from '@/components/signing-theater'
import { useTransaction } from '@/hooks/use-transactions'
import { useSSE } from '@/components/sse-provider'
import { apiFetch } from '@/lib/api'
import { explorerUrl, formatAmount, truncateAddress } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { TxStatus } from '@/lib/types'

const STATUS_COLOR: Record<TxStatus, string> = {
  draft:        '#9aa0aa',
  policy_check: '#f59e0b',
  signing:      '#2757c6',
  signed:       '#2757c6',
  broadcast:    '#0f5cc0',
  confirmed:    '#37c0a1',
  failed:       '#d0021b',
}

export default function TxStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const { data: tx, isLoading } = useTransaction(id, 5_000)
  const [replaceSigning, setReplaceSigning] = useState(false)
  const [replaceDone,    setReplaceDone]    = useState(false)

  useSSE((ev) => {
    if (ev.type === 'tx_confirmed' && tx?.tx_hash === ev.tx_hash) {
      queryClient.invalidateQueries({ queryKey: ['transactions', id] })
    }
  })

  async function handleReplace(action: 'cancel' | 'speed-up') {
    if (!tx) return
    setReplaceSigning(true)
    setReplaceDone(false)
    try {
      await apiFetch(`v1/transactions/${id}/${action}?wallet_id=${tx.wallet_id}`, { method: 'POST' })
      setReplaceDone(true)
      toast.success(action === 'cancel' ? 'Cancellation submitted' : 'Speed-up submitted')
      setTimeout(() => {
        setReplaceSigning(false)
        setReplaceDone(false)
        queryClient.invalidateQueries({ queryKey: ['transactions', id] })
        queryClient.invalidateQueries({ queryKey: ['all-transactions'] })
      }, 2000)
    } catch (err: unknown) {
      toast.error('Failed', { description: err instanceof Error ? err.message : String(err) })
      setReplaceSigning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-md space-y-4">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (!tx) return <p className="text-[#9aa0aa]">Transaction not found.</p>

  const isTerminal = tx.status === 'confirmed' || tx.status === 'failed'
  const dotColor   = STATUS_COLOR[tx.status] ?? '#9aa0aa'

  return (
    <div className="max-w-md space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <button className="w-9 h-9 rounded-xl bg-[#f5f5f5] flex items-center justify-center hover:bg-[#ededed] transition-colors">
            <ArrowLeft size={18} className="text-[#0c2550]" />
          </button>
        </Link>
        <h1 className="text-[#0c2550] text-xl font-bold">Transaction</h1>
        <span
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: dotColor + '22', color: dotColor }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
          {tx.status}
          {!isTerminal && <span className="animate-pulse">…</span>}
        </span>
      </div>

      {/* Amount hero */}
      <div className="bg-[#f5f5f5] rounded-2xl p-6 text-center">
        <p className="text-[#9aa0aa] text-sm mb-1">Amount sent</p>
        <p className="text-[#0c2550] text-4xl font-bold tabular-nums">
          {formatAmount(tx.amount_raw)}
        </p>
        <p className="text-[#9aa0aa] text-base mt-1">{tx.token}</p>
      </div>

      {/* Details */}
      <div className="bg-[#f5f5f5] rounded-2xl divide-y divide-[#ededed]">
        <Row label="To"      value={<span className="font-mono text-xs">{truncateAddress(tx.to_address, 8)}</span>} />
        <Row label="Network" value={tx.chain} />
        {tx.tx_hash && (
          <Row
            label="Tx hash"
            value={
              <a
                href={explorerUrl(tx.chain, tx.tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#007aff] font-mono text-xs hover:underline"
              >
                {tx.tx_hash.slice(0, 14)}…<ExternalLink size={11} />
              </a>
            }
          />
        )}
        {!!tx.block_number && (
          <Row label="Block" value={tx.block_number.toLocaleString()} />
        )}
      </div>

      {/* Timeline */}
      <div className="bg-[#f5f5f5] rounded-2xl p-5">
        <p className="text-[#0c2550] font-semibold text-sm mb-4">
          Progress
          {!isTerminal && (
            <span className="ml-2 text-xs text-[#9aa0aa] font-normal animate-pulse">updating…</span>
          )}
        </p>
        <TxTimeline status={tx.status} />
      </div>

      {/* Speed-up / Cancel — only for broadcast or signed txs */}
      {(tx.status === 'broadcast' || tx.status === 'signed') && (
        <div className="space-y-3">
          {(replaceSigning || replaceDone) ? (
            <div className="bg-[#f5f5f5] rounded-2xl p-4">
              <SigningTheater active={replaceSigning && !replaceDone} done={replaceDone} />
            </div>
          ) : (
            <>
              <p className="text-[#9aa0aa] text-xs px-1">
                Transaction is pending. You can speed it up with higher gas or cancel it.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleReplace('speed-up')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl font-semibold text-sm text-white transition-all active:scale-[0.97]"
                  style={{ background: 'linear-gradient(135deg, #0f5cc0, #007aff)' }}
                >
                  <Zap size={14} />
                  Speed up
                </button>
                <button
                  onClick={() => handleReplace('cancel')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl font-semibold text-sm border-2 border-[#f8d2d2] text-[#d0021b] hover:bg-[#f8d2d2] transition-all active:scale-[0.97]"
                >
                  <X size={14} />
                  Cancel tx
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[#9aa0aa] text-sm">{label}</span>
      <span className="text-[#0c2550] text-sm font-semibold">{value}</span>
    </div>
  )
}
