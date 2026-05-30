import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Wallet, WalletWithBalance } from '@/lib/types'

export function useWallets() {
  return useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => apiFetch('v1/wallets'),
  })
}

export function useWallet(id: string) {
  return useQuery<WalletWithBalance>({
    queryKey: ['wallets', id],
    queryFn: () => apiFetch(`v1/wallets/${id}`),
    enabled: !!id,
  })
}

export function useCreateWallet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (chain: string) =>
      apiFetch<Wallet>('v1/wallets', { method: 'POST', json: { chain } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets'] }),
  })
}
