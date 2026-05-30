import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyAddress } from './copy-address'
import { BalanceDisplay } from './balance-display'
import { chainLabel } from '@/lib/utils'
import type { WalletWithBalance } from '@/lib/types'

export function WalletCard({ data }: { data: WalletWithBalance }) {
  const { wallet, balances } = data
  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Badge variant="outline" className="text-xs text-blue-700 border-blue-200 bg-blue-50 mb-2">
              {chainLabel(wallet.chain)}
            </Badge>
            <CopyAddress address={wallet.address} />
          </div>
          <Link href={`/wallets/${wallet.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
              <ArrowUpRight size={16} />
            </Button>
          </Link>
        </div>
        <div className="space-y-1.5">
          <BalanceDisplay raw={balances.USDC} token="USDC" size="lg" />
          <BalanceDisplay raw={balances.USDT} token="USDT" size="sm" />
        </div>
        <div className="mt-4 flex gap-2">
          <Link href={`/send?wallet=${wallet.id}`} className="flex-1">
            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-xs">
              Send
            </Button>
          </Link>
          <Link href={`/wallets/${wallet.id}`} className="flex-1">
            <Button size="sm" variant="outline" className="w-full text-xs border-slate-200">
              Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
