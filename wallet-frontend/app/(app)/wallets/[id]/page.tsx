'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Send } from 'lucide-react'
import { useWallet } from '@/hooks/use-wallets'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { chainTheme, gradientStyle } from '@/lib/chain-theme'
import { explorerUrl, formatAmount, truncateAddress } from '@/lib/utils'
import { CopyAddress } from '@/components/copy-address'
import { PriceChart } from '@/components/price-chart'
import { ReceiveModal } from '@/components/receive-modal'
import { TxStatusBadge } from '@/components/tx-status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useState } from 'react'
import type { Tx } from '@/lib/types'

function useTxHistory(walletId: string) {
  return useQuery<Tx[]>({
    queryKey: ['transactions', 'wallet', walletId],
    queryFn: () => apiFetch<Tx[]>(`v1/wallets/${walletId}/transactions`).catch((): Tx[] => []),
    enabled: !!walletId,
    refetchInterval: 10_000,
  })
}

export default function WalletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading } = useWallet(id)
  const { data: txs = [] }  = useTxHistory(id)
  const [receiveOpen, setReceiveOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (!data) return <p className="text-[#9aa0aa]">Wallet not found.</p>

  const { wallet, balances } = data
  const theme = chainTheme(wallet.chain)

  return (
    <div className="max-w-lg space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <button className="w-9 h-9 rounded-xl bg-[#f5f5f5] flex items-center justify-center hover:bg-[#ededed] transition-colors">
            <ArrowLeft size={18} className="text-[#0c2550]" />
          </button>
        </Link>
        <h1 className="text-[#0c2550] text-xl font-bold">Wallet</h1>
      </div>

      {/* Wallet hero card */}
      <div className="rounded-2xl p-6 text-white shadow-md" style={gradientStyle(theme)}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-widest">{theme.label}</p>
            <CopyAddress address={wallet.address} chars={6} className="text-white/90 text-sm mt-0.5" />
          </div>
        </div>
        <p className="text-white/70 text-xs mb-1">Balance</p>
        <p className="text-white text-4xl font-bold tabular-nums">
          {formatAmount(balances.USDC)}
          <span className="text-white/60 text-lg font-normal ml-2">USDC</span>
        </p>
        {balances.USDT !== '0' && (
          <p className="text-white/70 text-sm mt-1 tabular-nums">
            {formatAmount(balances.USDT)} USDT
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/send?wallet=${wallet.id}`}>
          <button
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #0f5cc0 0%, #007aff 100%)' }}
          >
            <Send size={15} />
            Send
          </button>
        </Link>
        <button
          onClick={() => setReceiveOpen(true)}
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm border-2 border-[#ededed] text-[#0c2550] hover:bg-[#f5f5f5] transition-all active:scale-[0.97]"
        >
          Receive
        </button>
      </div>

      {/* Price chart — only for EVM stablecoins */}
      {wallet.chain !== 'solana' && (
        <PriceChart token="USDC" />
      )}

      {/* Transaction history */}
      <div>
        <p className="text-[#0c2550] font-semibold text-sm mb-3">Transaction history</p>
        {txs.length === 0 ? (
          <div className="text-center py-10 text-[#9aa0aa]">
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="bg-[#f5f5f5] rounded-2xl divide-y divide-[#ededed] overflow-hidden">
            {txs.map((tx) => (
              <Link
                key={tx.id}
                href={`/tx/${tx.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#ededed] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[#0c2550] text-sm font-semibold truncate">
                    Sent {tx.token} · {truncateAddress(tx.to_address, 5)}
                  </p>
                  <p className="text-[#9aa0aa] text-xs mt-0.5">{tx.created_at?.slice(0, 10)}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-[#d0021b] text-sm font-semibold tabular-nums">
                    −{formatAmount(tx.amount_raw)} {tx.token}
                  </p>
                  <TxStatusBadge status={tx.status} />
                </div>
                {tx.tx_hash && (
                  <a
                    href={explorerUrl(tx.chain, tx.tx_hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[#9aa0aa] hover:text-[#007aff]"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <ReceiveModal open={receiveOpen} onClose={() => setReceiveOpen(false)} wallet={wallet} />
    </div>
  )
}
