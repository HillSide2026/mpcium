import { useQuery } from '@tanstack/react-query'
import { formatAmount } from '@/lib/utils'
import type { WalletWithBalance } from '@/lib/types'

type CoinGeckoPrices = {
  'usd-coin': { usd: number }
  tether:     { usd: number }
}

async function fetchPrices(): Promise<CoinGeckoPrices> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether&vs_currencies=usd',
    { cache: 'no-store' },
  )
  if (!res.ok) throw new Error('CoinGecko fetch failed')
  return res.json()
}

export function useUSDValue(wallets: WalletWithBalance[]) {
  const { data: prices } = useQuery<CoinGeckoPrices>({
    queryKey: ['coingecko-prices'],
    queryFn: fetchPrices,
    refetchInterval: 60_000,
    staleTime: 50_000,
    retry: 2,
  })

  if (!prices || !wallets.length) return null

  let total = 0
  for (const { balances } of wallets) {
    const usdc = parseFloat(formatAmount(balances.USDC)) * (prices['usd-coin']?.usd ?? 1)
    const usdt = parseFloat(formatAmount(balances.USDT)) * (prices.tether?.usd ?? 1)
    total += usdc + usdt
  }

  return total
}
