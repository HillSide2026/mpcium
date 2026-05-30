'use client'

import { useState } from 'react'
import { Plus, Loader2, Eye, EyeOff, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CopyAddress } from './copy-address'
import { KeygenCeremony } from './keygen-ceremony'
import { ReceiveModal } from './receive-modal'
import { chainTheme, gradientStyle } from '@/lib/chain-theme'
import { formatAmount } from '@/lib/utils'
import { useCreateWallet } from '@/hooks/use-wallets'
import type { WalletWithBalance } from '@/lib/types'

const CARD_W = 320 // px — matches BlueWallet's ~375px scaled down for sidebar layout

function WalletCard({
  data,
  hidden,
}: {
  data: WalletWithBalance
  hidden: boolean
}) {
  const { wallet, balances } = data
  const theme = chainTheme(wallet.chain)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const totalUsdc = formatAmount(balances.USDC)
  const totalUsdt = formatAmount(balances.USDT)

  return (
    <>
      <div
        className="snap-start shrink-0 rounded-2xl p-5 flex flex-col justify-between select-none
                   transition-transform duration-150 active:scale-[0.97] cursor-default shadow-md"
        style={{ ...gradientStyle(theme), width: CARD_W, height: 180 }}
      >
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-0.5">
              {theme.label}
            </p>
            <CopyAddress
              address={wallet.address}
              chars={5}
              className="text-white/90 text-xs"
            />
          </div>
          <button
            onClick={() => setReceiveOpen(true)}
            className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            title="Receive"
          >
            <QrCode size={14} className="text-white" />
          </button>
        </div>

        {/* Balance */}
        <div>
          {hidden ? (
            <p className="text-white text-3xl font-bold tracking-tight">••••••</p>
          ) : (
            <div>
              <p className="text-white text-3xl font-bold tracking-tight leading-none">
                {totalUsdc}
                <span className="text-white/60 text-base font-normal ml-1.5">USDC</span>
              </p>
              {totalUsdt !== '0' && (
                <p className="text-white/70 text-sm font-medium mt-1">
                  {totalUsdt} <span className="text-white/50 text-xs">USDT</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <ReceiveModal open={receiveOpen} onClose={() => setReceiveOpen(false)} wallet={wallet} />
    </>
  )
}

function AddCard({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="snap-start shrink-0 rounded-2xl border-2 border-dashed border-[#ccddf9]
                 flex flex-col items-center justify-center gap-2
                 hover:bg-[#f0f6ff] transition-colors duration-150"
      style={{ width: CARD_W, height: 180 }}
    >
      {loading ? (
        <>
          <Loader2 size={24} className="text-[#007aff] animate-spin" />
          <p className="text-[#007aff] text-sm font-medium">Generating keys…</p>
          <p className="text-[#9aa0aa] text-xs">2-of-3 MPC keygen running</p>
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-full bg-[#ccddf9] flex items-center justify-center">
            <Plus size={20} className="text-[#007aff]" />
          </div>
          <p className="text-[#007aff] text-sm font-semibold">Add wallet</p>
        </>
      )}
    </button>
  )
}

export function WalletCarousel({
  wallets,
  onCreated,
  openCreateOnMount = false,
}: {
  wallets: WalletWithBalance[]
  onCreated: () => void
  openCreateOnMount?: boolean
}) {
  const createWallet = useCreateWallet()
  const [hidden, setHidden]         = useState(false)
  const [createOpen, setCreateOpen] = useState(openCreateOnMount)
  const [chain, setChain]           = useState('ethereum')
  const [ceremonyDone, setCeremonyDone] = useState(false)

  async function handleCreate() {
    setCeremonyDone(false)
    try {
      const w = await createWallet.mutateAsync(chain)
      setCeremonyDone(true)
      // Small delay so user sees the done state before dialog closes
      setTimeout(() => {
        setCreateOpen(false)
        setCeremonyDone(false)
        toast.success('Wallet created', { description: w.address, duration: 8000 })
        onCreated()
      }, 2000)
    } catch (err: unknown) {
      toast.error('Failed to create wallet', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-[#0c2550] font-semibold text-base">My Wallets</h2>
        <button
          onClick={() => setHidden((h) => !h)}
          className="text-[#9aa0aa] hover:text-[#0c2550] transition-colors"
          title={hidden ? 'Show balances' : 'Hide balances'}
        >
          {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>

      {/* Carousel */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x-mandatory pb-2">
        {wallets.map((w) => (
          <WalletCard key={w.wallet.id} data={w} hidden={hidden} />
        ))}
        <AddCard onClick={() => setCreateOpen(true)} loading={createWallet.isPending} />
      </div>

      {/* Create wallet dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!createWallet.isPending) setCreateOpen(o) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#0c2550]">
              {createWallet.isPending || ceremonyDone ? 'Creating wallet…' : 'Add wallet'}
            </DialogTitle>
            {!createWallet.isPending && !ceremonyDone && (
              <DialogDescription className="text-[#9aa0aa]">
                A 2-of-3 MPC keygen distributes your key across 3 independent nodes.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Show ceremony when running or done; show form otherwise */}
            {(createWallet.isPending || ceremonyDone) ? (
              <KeygenCeremony active={createWallet.isPending} done={ceremonyDone} />
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[#0c2550] text-sm">Network</Label>
                  <Select value={chain} onValueChange={setChain}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="polygon">Polygon</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="optimism">Optimism</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleCreate}
                  className="w-full bg-[#007aff] hover:bg-[#0f5cc0] text-white font-semibold"
                >
                  Create wallet
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
