import { formatAmount } from '@/lib/utils'

export function BalanceDisplay({
  raw,
  token,
  size = 'md',
}: {
  raw: string
  token: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const amount = formatAmount(raw)
  const sizeClass = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl font-semibold' }[size]

  return (
    <span className={`font-mono tabular-nums ${sizeClass}`}>
      {amount}{' '}
      <span className="text-slate-500 font-sans font-normal text-[0.85em]">{token}</span>
    </span>
  )
}
