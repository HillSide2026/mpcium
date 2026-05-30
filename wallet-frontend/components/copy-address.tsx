'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { truncateAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function CopyAddress({
  address,
  chars = 6,
  className,
}: {
  address: string
  chars?: number
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={copy}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-sm text-slate-600 hover:text-slate-900 transition-colors group',
        className,
      )}
      title={address}
    >
      <span>{truncateAddress(address, chars)}</span>
      {copied ? (
        <Check size={13} className="text-green-600 shrink-0" />
      ) : (
        <Copy size={13} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
      )}
    </button>
  )
}
