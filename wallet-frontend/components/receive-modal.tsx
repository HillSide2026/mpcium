'use client'

import QRCode from 'react-qr-code'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CopyAddress } from './copy-address'
import { chainTheme, gradientStyle } from '@/lib/chain-theme'
import type { Wallet } from '@/lib/types'

export function ReceiveModal({
  open,
  onClose,
  wallet,
}: {
  open: boolean
  onClose: () => void
  wallet: Wallet
}) {
  const theme = chainTheme(wallet.chain)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs text-center">
        <DialogHeader>
          <DialogTitle className="text-[#0c2550] text-center">Receive</DialogTitle>
        </DialogHeader>

        {/* Network badge */}
        <div className="flex justify-center">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={gradientStyle(theme)}
          >
            {theme.label}
          </span>
        </div>

        {/* QR code */}
        <div className="flex justify-center p-4">
          <div className="p-4 bg-white rounded-2xl border border-[#ededed] shadow-sm inline-block">
            <QRCode value={wallet.address} size={180} />
          </div>
        </div>

        {/* Address */}
        <div className="bg-[#f5f5f5] rounded-xl px-4 py-3">
          <p className="text-[#9aa0aa] text-xs mb-1.5 uppercase tracking-wide font-medium">
            Address
          </p>
          <CopyAddress
            address={wallet.address}
            chars={8}
            className="text-[#0c2550] justify-center text-sm font-medium"
          />
        </div>

        <p className="text-[#9aa0aa] text-xs leading-relaxed">
          Only send USDC or USDT on {theme.label} to this address.
        </p>
      </DialogContent>
    </Dialog>
  )
}
