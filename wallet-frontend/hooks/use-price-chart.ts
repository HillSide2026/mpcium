import { useQuery } from '@tanstack/react-query'

const COINGECKO_IDS: Record<string, string> = {
  USDC: 'usd-coin',
  USDT: 'tether',
}

type PricePoint = { time: number; price: number }

async function fetchChart(token: string, days: number): Promise<PricePoint[]> {
  const id = COINGECKO_IDS[token.toUpperCase()] ?? 'usd-coin'
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
  )
  if (!res.ok) throw new Error('CoinGecko fetch failed')
  const data = await res.json()
  // prices: [[timestamp_ms, price], ...]
  return (data.prices as [number, number][]).map(([time, price]) => ({ time, price }))
}

export function usePriceChart(token: string, days: 7 | 30 | 90) {
  return useQuery<PricePoint[]>({
    queryKey: ['price-chart', token, days],
    queryFn: () => fetchChart(token, days),
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
