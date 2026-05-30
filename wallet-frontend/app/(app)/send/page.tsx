'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWallets } from '@/hooks/use-wallets'
import { chainTheme, gradientStyle } from '@/lib/chain-theme'
import { truncateAddress, toRawAmount } from '@/lib/utils'

function isValidAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

function SendContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { data: wallets, isLoading } = useWallets()

  const [walletId,   setWalletId]   = useState(searchParams.get('wallet') ?? '')
  const [token,      setToken]      = useState('USDC')
  const [toAddress,  setToAddress]  = useState('')
  const [amount,     setAmount]     = useState('')
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!walletId && wallets?.length) setWalletId(wallets[0].id)
  }, [wallets, walletId])

  const selectedWallet = wallets?.find((w) => w.id === walletId)
  const theme = selectedWallet ? chainTheme(selectedWallet.chain) : null

  function validate() {
    if (!walletId)                  return 'Select a wallet'
    if (!isValidAddress(toAddress)) return 'Enter a valid 0x… Ethereum address'
    if (!amount || Number(amount) <= 0) return 'Enter a valid amount'
    return null
  }

  function handleReview() {
    const err = validate()
    if (err) { setError(err); return }
    const raw = toRawAmount(amount)
    router.push(`/send/confirm?${new URLSearchParams({ walletId, token, toAddress, amount, raw })}`)
  }

  return (
    <div className="max-w-md space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <button className="w-9 h-9 rounded-xl bg-[#f5f5f5] flex items-center justify-center hover:bg-[#ededed] transition-colors">
            <ArrowLeft size={18} className="text-[#0c2550]" />
          </button>
        </Link>
        <h1 className="text-[#0c2550] text-xl font-bold">Send</h1>
      </div>

      {/* Wallet selector — rendered as gradient previews */}
      <div>
        <Label className="text-[#9aa0aa] text-xs uppercase tracking-wide font-medium mb-2 block">From</Label>
        <div className="space-y-2">
          {wallets?.map((w) => {
            const t = chainTheme(w.chain)
            return (
              <button
                key={w.id}
                onClick={() => { setWalletId(w.id); setError('') }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-150"
                style={{
                  borderColor: walletId === w.id ? t.from : '#ededed',
                  background:  walletId === w.id ? '#f0f6ff' : '#fff',
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg shrink-0"
                  style={gradientStyle(t)}
                />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-[#0c2550] text-sm font-semibold">{t.label}</p>
                  <p className="text-[#9aa0aa] text-xs font-mono truncate">{truncateAddress(w.address, 6)}</p>
                </div>
                {walletId === w.id && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: t.from }}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Token */}
      <div>
        <Label className="text-[#9aa0aa] text-xs uppercase tracking-wide font-medium mb-2 block">Token</Label>
        <div className="flex gap-2">
          {['USDC', 'USDT'].map((t) => (
            <button
              key={t}
              onClick={() => setToken(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-150"
              style={{
                borderColor: token === t ? '#007aff' : '#ededed',
                background:  token === t ? '#ccddf9' : '#fff',
                color:       token === t ? '#0f5cc0' : '#9aa0aa',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* To address */}
      <div>
        <Label htmlFor="to" className="text-[#9aa0aa] text-xs uppercase tracking-wide font-medium mb-2 block">
          Recipient
        </Label>
        <Input
          id="to"
          placeholder="0x…"
          value={toAddress}
          onChange={(e) => { setToAddress(e.target.value); setError('') }}
          className="font-mono text-sm border-[#ededed] focus:border-[#007aff] bg-[#f5f5f5] rounded-xl"
        />
      </div>

      {/* Amount */}
      <div>
        <Label htmlFor="amount" className="text-[#9aa0aa] text-xs uppercase tracking-wide font-medium mb-2 block">
          Amount
        </Label>
        <div className="relative">
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.000001"
            placeholder="0.00"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError('') }}
            className="pr-16 border-[#ededed] focus:border-[#007aff] bg-[#f5f5f5] rounded-xl text-lg font-semibold text-[#0c2550]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9aa0aa] font-medium">
            {token}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#d0021b] bg-[#f8d2d2] rounded-xl px-4 py-2.5">{error}</p>
      )}

      <button
        onClick={handleReview}
        className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-semibold text-base transition-all duration-150 active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #0f5cc0 0%, #007aff 100%)' }}
      >
        Review transfer
        <ChevronRight size={20} />
      </button>
    </div>
  )
}

export default function SendPage() {
  return (
    <Suspense fallback={<div className="text-[#9aa0aa] text-sm p-8">Loading…</div>}>
      <SendContent />
    </Suspense>
  )
}
