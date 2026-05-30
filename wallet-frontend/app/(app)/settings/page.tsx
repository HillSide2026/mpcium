'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWallets } from '@/hooks/use-wallets'
import { apiFetch } from '@/lib/api'
import { truncateAddress, chainLabel } from '@/lib/utils'
import type { PolicyRules } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function usePolicyRules(walletId: string) {
  return useQuery<PolicyRules>({
    queryKey: ['policy', walletId],
    queryFn: () => apiFetch(`v1/wallets/${walletId}/policy`),
    enabled: !!walletId,
  })
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[#9aa0aa] text-xs uppercase tracking-wide font-medium mb-2 px-1">{title}</p>
      <div className="bg-[#f5f5f5] rounded-2xl divide-y divide-[#ededed] overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[#0c2550] text-sm font-medium mb-1.5">{label}</p>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { data: wallets } = useWallets()
  const [walletId, setWalletId] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!walletId && wallets?.length) setWalletId(wallets[0].id)
  }, [wallets, walletId])

  const { data: rules, isLoading } = usePolicyRules(walletId)

  const [maxSingle, setMaxSingle] = useState('')
  const [daily,     setDaily]     = useState('')
  const [velocity,  setVelocity]  = useState('')
  const [whitelist, setWhitelist] = useState('')

  useEffect(() => {
    if (!rules) return
    setMaxSingle(rules.max_single_tx      ?? '')
    setDaily(    rules.daily_limit        ?? '')
    setVelocity( rules.velocity_per_hour  ?? '')
    try {
      const addrs: string[] = rules.dest_whitelist ? JSON.parse(rules.dest_whitelist) : []
      setWhitelist(addrs.join('\n'))
    } catch { setWhitelist('') }
  }, [rules])

  const saveMutation = useMutation({
    mutationFn: (payload: PolicyRules) =>
      apiFetch(`v1/wallets/${walletId}/policy`, { method: 'PUT', json: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy', walletId] })
      toast.success('Policy saved')
    },
    onError: (err: Error) => toast.error('Save failed', { description: err.message }),
  })

  function handleSave() {
    const addrs = whitelist.split('\n').map((a) => a.trim()).filter(Boolean)
    const payload: PolicyRules = {}
    if (maxSingle)    payload.max_single_tx     = maxSingle
    if (daily)        payload.daily_limit        = daily
    if (velocity)     payload.velocity_per_hour  = velocity
    if (addrs.length) payload.dest_whitelist     = JSON.stringify(addrs)
    saveMutation.mutate(payload)
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-[#0c2550] text-xl font-bold">Settings</h1>

      {/* Wallet selector */}
      <Section title="Wallet">
        <div className="px-4 py-3">
          <Select value={walletId} onValueChange={setWalletId}>
            <SelectTrigger className="border-0 bg-transparent p-0 h-auto shadow-none text-[#0c2550] font-semibold focus:ring-0">
              <SelectValue placeholder="Select wallet…" />
            </SelectTrigger>
            <SelectContent>
              {wallets?.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {truncateAddress(w.address)} · {chainLabel(w.chain)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      {walletId && (
        <>
          <Section title="Spending limits">
            <FieldRow label="Max single transfer (raw units)">
              <Input
                placeholder="e.g. 1000000 = 1 USDC"
                value={maxSingle}
                onChange={(e) => setMaxSingle(e.target.value)}
                className="bg-white border-[#ededed] rounded-xl text-sm text-[#0c2550]"
              />
            </FieldRow>
            <FieldRow label="Daily rolling limit (raw units)">
              <Input
                placeholder="e.g. 10000000 = 10 USDC"
                value={daily}
                onChange={(e) => setDaily(e.target.value)}
                className="bg-white border-[#ededed] rounded-xl text-sm text-[#0c2550]"
              />
            </FieldRow>
            <FieldRow label="Max transactions per hour">
              <Input
                type="number" min="0"
                placeholder="e.g. 5"
                value={velocity}
                onChange={(e) => setVelocity(e.target.value)}
                className="bg-white border-[#ededed] rounded-xl text-sm text-[#0c2550]"
              />
            </FieldRow>
          </Section>

          <Section title="Destination whitelist">
            <FieldRow label="Allowed addresses (one per line)">
              <p className="text-[#9aa0aa] text-xs mb-2">
                If non-empty, only listed addresses can receive funds from this wallet.
              </p>
              <textarea
                className="w-full bg-white border border-[#ededed] rounded-xl px-3 py-2 text-sm font-mono text-[#0c2550] placeholder:text-[#9aa0aa] focus:outline-none focus:border-[#007aff] resize-none"
                rows={4}
                placeholder={"0x1234…\n0x5678…"}
                value={whitelist}
                onChange={(e) => setWhitelist(e.target.value)}
              />
            </FieldRow>
          </Section>

          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || isLoading}
            className="w-full py-4 rounded-2xl text-white font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, #0f5cc0 0%, #007aff 100%)' }}
          >
            {saveMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" />Saving…</>
            ) : 'Save policy'}
          </button>
        </>
      )}
    </div>
  )
}
