'use client'

import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { usePriceChart } from '@/hooks/use-price-chart'
import { Skeleton } from '@/components/ui/skeleton'

const RANGES = [7, 30, 90] as const
type Range = typeof RANGES[number]

function formatDate(ts: number, days: Range) {
  const d = new Date(ts)
  if (days === 7)  return d.toLocaleDateString('en-US', { weekday: 'short' })
  if (days === 30) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { time: number } }[] }) {
  if (!active || !payload?.length) return null
  const { value, payload: { time } } = payload[0]
  return (
    <div className="bg-white border border-[#ededed] rounded-xl px-3 py-2 shadow-sm">
      <p className="text-[#9aa0aa] text-xs">{new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
      <p className="text-[#0c2550] text-sm font-semibold">${value.toFixed(4)}</p>
    </div>
  )
}

export function PriceChart({ token }: { token: string }) {
  const [range, setRange] = useState<Range>(7)
  const { data, isLoading } = usePriceChart(token, range)

  // Compute % change over the period
  const pctChange = data && data.length >= 2
    ? ((data[data.length - 1].price - data[0].price) / data[0].price) * 100
    : null
  const isPositive = pctChange !== null && pctChange >= 0

  return (
    <div className="bg-[#f5f5f5] rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[#0c2550] text-sm font-semibold">{token} Price</p>
          {pctChange !== null && (
            <p className={`text-xs font-medium mt-0.5 ${isPositive ? 'text-[#37c0a1]' : 'text-[#d0021b]'}`}>
              {isPositive ? '+' : ''}{pctChange.toFixed(3)}%
            </p>
          )}
        </div>
        {/* Range pills */}
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: range === r ? '#0c2550' : 'transparent',
                color:      range === r ? '#ffffff' : '#9aa0aa',
              }}
            >
              {r}D
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <Skeleton className="h-36 rounded-xl" />
      ) : !data?.length ? (
        <p className="text-center text-[#9aa0aa] text-xs py-8">Price data unavailable</p>
      ) : (
        <ResponsiveContainer width="100%" height={144}>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#007aff" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#007aff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ededed" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(t) => formatDate(t, range)}
              tick={{ fontSize: 10, fill: '#9aa0aa' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 10, fill: '#9aa0aa' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v.toFixed(4)}`}
              width={54}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#007aff"
              strokeWidth={1.5}
              fill="url(#priceGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#007aff', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
