'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { WalletCarousel } from '@/components/wallet-carousel'
import { ActivityFeed } from '@/components/activity-feed'
import { ClusterStatus } from '@/components/cluster-status'
import { MpcOnboarding } from '@/components/mpc-onboarding'
import { AnimatedNumber } from '@/components/animated-number'
import { apiFetch } from '@/lib/api'
import { useWallets } from '@/hooks/use-wallets'
import { useUSDValue } from '@/hooks/use-usd-value'
import type { WalletWithBalance, Tx } from '@/lib/types'

function useWalletsWithBalances() {
  const { data: wallets } = useWallets()
  return useQuery<WalletWithBalance[]>({
    queryKey: ['wallets-with-balances'],
    queryFn: async () => {
      if (!wallets?.length) return []
      return Promise.all(wallets.map((w) => apiFetch<WalletWithBalance>(`v1/wallets/${w.id}`)))
    },
    enabled: !!wallets,
    staleTime: 30_000,
  })
}

function useAllTransactions(walletIds: string[]) {
  return useQuery<Tx[]>({
    queryKey: ['all-transactions', walletIds.join(',')],
    queryFn: async () => {
      if (!walletIds.length) return []
      const results = await Promise.all(
        walletIds.map((id) =>
          apiFetch<Tx[]>(`v1/wallets/${id}/transactions`).catch((): Tx[] => []),
        ),
      )
      return results
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },
    enabled: walletIds.length > 0,
    refetchInterval: 15_000,
  })
}

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const { data: walletsWithBalances, isLoading } = useWalletsWithBalances()
  const walletIds = walletsWithBalances?.map((w) => w.wallet.id) ?? []
  const { data: transactions = [] } = useAllTransactions(walletIds)
  const totalUSD = useUSDValue(walletsWithBalances ?? [])
  const [refreshing, setRefreshing] = useState(false)
  // Track whether the create wallet dialog was opened from the onboarding empty state
  const [showCreate, setShowCreate] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wallets'] }),
      queryClient.invalidateQueries({ queryKey: ['wallets-with-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['all-transactions'] }),
    ])
    setTimeout(() => setRefreshing(false), 600)
  }

  function refetchAll() {
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
    queryClient.invalidateQueries({ queryKey: ['wallets-with-balances'] })
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-10 rounded-2xl" />
        <div className="flex gap-4">
          <Skeleton className="h-45 w-80 rounded-2xl" />
          <Skeleton className="h-45 w-80 rounded-2xl opacity-50" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const hasWallets = (walletsWithBalances?.length ?? 0) > 0

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Trust header — always visible */}
      <ClusterStatus />

      {hasWallets ? (
        <>
          {/* Portfolio value + refresh */}
          <div className="flex items-end justify-between px-1">
            <div>
              <p className="text-[#9aa0aa] text-xs uppercase tracking-wide font-medium mb-0.5">
                Total portfolio
              </p>
              {totalUSD !== null ? (
                <AnimatedNumber
                  value={totalUSD}
                  prefix="$"
                  decimals={2}
                  className="text-[#0c2550] text-3xl font-bold tabular-nums"
                />
              ) : (
                <p className="text-[#0c2550] text-3xl font-bold">—</p>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-[#9aa0aa] hover:text-[#0c2550] transition-colors text-xs font-medium"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <WalletCarousel wallets={walletsWithBalances ?? []} onCreated={refetchAll} />
          <ActivityFeed transactions={transactions} />
        </>
      ) : (
        /* Empty state — first-time user. Show onboarding + a carousel that pops open on demand. */
        <>
          <MpcOnboarding onCreate={() => setShowCreate(true)} />
          {showCreate && (
            <WalletCarousel
              wallets={[]}
              onCreated={() => { refetchAll(); setShowCreate(false) }}
              openCreateOnMount
            />
          )}
        </>
      )}
    </div>
  )
}
