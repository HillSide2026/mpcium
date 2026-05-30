import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convert raw token units (6 decimal USDC/USDT) to human-readable string.
export function formatAmount(raw: string, decimals = 6): string {
  try {
    const n = BigInt(raw)
    const divisor = BigInt(10 ** decimals)
    const whole = n / divisor
    const frac = n % divisor
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
    return fracStr ? `${whole}.${fracStr}` : `${whole}`
  } catch {
    return '0'
  }
}

// Convert a human-readable decimal string to raw token units.
export function toRawAmount(display: string, decimals = 6): string {
  try {
    const [whole = '0', frac = ''] = display.split('.')
    const fracPadded = frac.padEnd(decimals, '0').slice(0, decimals)
    return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(fracPadded || '0')).toString()
  } catch {
    return '0'
  }
}

export function truncateAddress(addr: string, chars = 6): string {
  if (!addr || addr.length < chars * 2 + 2) return addr
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`
}

const explorers: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon:  'https://polygonscan.com/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  base:     'https://basescan.org/tx/',
  optimism: 'https://optimistic.etherscan.io/tx/',
  solana:   'https://solscan.io/tx/',
}

export function explorerUrl(chain: string, txHash: string): string {
  return (explorers[chain.toLowerCase()] ?? explorers.ethereum) + txHash
}

const labels: Record<string, string> = {
  ethereum: 'Ethereum',
  polygon:  'Polygon',
  arbitrum: 'Arbitrum',
  base:     'Base',
  optimism: 'Optimism',
  solana:   'Solana',
}

export function chainLabel(chain: string): string {
  return labels[chain.toLowerCase()] ?? chain
}
