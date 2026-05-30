'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { useSend } from '@/hooks/use-transactions'
import { SigningTheater } from '@/components/signing-theater'
import { chainTheme, gradientStyle } from '@/lib/chain-theme'
import { truncateAddress } from '@/lib/utils'
import { useWallet } from '@/hooks/use-wallets'

function ConfirmContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const walletId     = searchParams.get('walletId')  ?? ''
  const token        = searchParams.get('token')     ?? 'USDC'
  const toAddress    = searchParams.get('toAddress') ?? ''
  const amount       = searchParams.get('amount')    ?? ''
  const raw          = searchParams.get('raw')       ?? '0'

  const { data: walletData } = useWallet(walletId)
  const send = useSend()
  const [submitting,  setSubmitting]  = useState(false)
  const [signingDone, setSigningDone] = useState(false)

  const chain = walletData?.wallet.chain ?? 'ethereum'
  const from  = walletData?.wallet.address ?? ''
  const theme = chainTheme(chain)

  async function handleConfirm() {
    setSubmitting(true)
    setSigningDone(false)
    try {
      const tx = await send.mutateAsync({ wallet_id: walletId, token, to_address: toAddress, amount: raw })
      setSigningDone(true)
      toast.success('Transaction submitted')
      setTimeout(() => router.push(`/tx/${tx.id}`), 1200)
    } catch (err: unknown) {
      toast.error('Transfer failed', { description: err instanceof Error ? err.message : 'Failed' })
      setSubmitting(false)
      setSigningDone(false)
    }
  }

  return (
    <div className="max-w-md space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/send">
          <button className="w-9 h-9 rounded-xl bg-[#f5f5f5] flex items-center justify-center hover:bg-[#ededed] transition-colors">
            <ArrowLeft size={18} className="text-[#0c2550]" />
          </button>
        </Link>
        <h1 className="text-[#0c2550] text-xl font-bold">Confirm</h1>
      </div>

      {/* Amount hero */}
      <div
        className="rounded-2xl p-6 text-center text-white"
        style={gradientStyle(theme)}
      >
        <p className="text-white/70 text-sm mb-1">Sending</p>
        <p className="text-5xl font-bold tracking-tight">{amount}</p>
        <p className="text-white/80 text-lg mt-1">{token}</p>
      </div>

      {/* Details card */}
      <div className="bg-[#f5f5f5] rounded-2xl divide-y divide-[#ededed]">
        <Row label="Network"  value={theme.label} />
        <Row label="From"     value={<span className="font-mono text-xs">{truncateAddress(from, 8)}</span>} />
        <Row label="To"       value={<span className="font-mono text-xs">{truncateAddress(toAddress, 8)}</span>} />
        <Row label="Token"    value={token} />
      </div>

      {/* Policy notice — hide during signing */}
      {!submitting && !signingDone && (
        <div className="flex items-start gap-3 bg-[#d2f8d6] rounded-xl px-4 py-3">
          <ShieldCheck size={16} className="text-[#37c0a1] mt-0.5 shrink-0" />
          <p className="text-sm text-[#0c2550]">
            Policy checks run automatically before signing. Invalid transfers are rejected.
          </p>
        </div>
      )}

      {/* Signing theater — appears when signing starts */}
      {(submitting || signingDone) && (
        <div className="bg-[#f5f5f5] rounded-2xl p-5">
          <SigningTheater active={submitting && !signingDone} done={signingDone} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Link href="/send" className="flex-1">
          <button
            className="w-full py-4 rounded-2xl border-2 border-[#ededed] text-[#9aa0aa] font-semibold text-sm hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
            disabled={submitting}
          >
            Cancel
          </button>
        </Link>
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="flex-1 py-4 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-70"
          style={{ background: 'linear-gradient(135deg, #0f5cc0 0%, #007aff 100%)' }}
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" />Signing…</>
          ) : 'Confirm & Sign'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[#9aa0aa] text-sm">{label}</span>
      <span className="text-[#0c2550] text-sm font-semibold">{value}</span>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="text-[#9aa0aa] text-sm p-8">Loading…</div>}>
      <ConfirmContent />
    </Suspense>
  )
}
