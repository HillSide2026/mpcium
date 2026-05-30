'use client'

import Link from 'next/link'
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { formatAmount, truncateAddress } from '@/lib/utils'
import type { Tx, TxStatus } from '@/lib/types'

type ActivityItem = Tx & { walletAddress?: string }

function statusIcon(status: TxStatus) {
  if (status === 'confirmed') return <CheckCircle2 size={16} className="text-[#37c0a1]" />
  if (status === 'failed')    return <XCircle size={16} className="text-[#d0021b]" />
  return <Clock size={16} className="text-[#2757c6]" />
}

function TxRow({ tx }: { tx: ActivityItem }) {
  const isOutgoing = true // all our txs are sends for now
  const isPending  = !['confirmed', 'failed'].includes(tx.status)

  const iconBg    = isOutgoing ? '#f8d2d2' : '#d2f8d6'
  const iconColor = isOutgoing ? '#d0021b' : '#37c0a1'
  const amountCls = isOutgoing ? 'text-[#d0021b]' : 'text-[#37c0a1]'

  return (
    <Link
      href={`/tx/${tx.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-[#f5f5f5] transition-colors duration-100 rounded-xl"
    >
      {/* Icon circle */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: isPending ? '#e8efff' : iconBg }}
      >
        {isPending ? (
          statusIcon(tx.status)
        ) : isOutgoing ? (
          <ArrowUpRight size={18} style={{ color: iconColor }} />
        ) : (
          <ArrowDownLeft size={18} style={{ color: iconColor }} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[#0c2550] text-sm font-semibold truncate">
          {isOutgoing ? 'Sent' : 'Received'} {tx.token}
        </p>
        <p className="text-[#9aa0aa] text-xs truncate mt-0.5">
          To {truncateAddress(tx.to_address, 5)}
        </p>
      </div>

      {/* Amount + status */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold tabular-nums ${isPending ? 'text-[#2757c6]' : amountCls}`}>
          {isOutgoing ? '−' : '+'}{formatAmount(tx.amount_raw)} {tx.token}
        </p>
        <p className="text-[#9aa0aa] text-xs capitalize mt-0.5">{tx.status}</p>
      </div>
    </Link>
  )
}

export function ActivityFeed({ transactions }: { transactions: ActivityItem[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-[#0c2550] font-semibold text-base">Transactions</h2>
        {transactions.length > 0 && (
          <span className="text-[#9aa0aa] text-xs">{transactions.length} total</span>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12 text-[#9aa0aa]">
          <p className="text-sm">No transactions yet</p>
          <p className="text-xs mt-1">Send or receive stablecoins to get started</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {transactions.map((tx) => (
            <TxRow key={tx.id} tx={tx} />
          ))}
        </div>
      )}
    </div>
  )
}
