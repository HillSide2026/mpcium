import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Tx } from '@/lib/types'

export function useTransaction(id: string, refetchInterval?: number) {
  return useQuery<Tx>({
    queryKey: ['transactions', id],
    queryFn: () => apiFetch(`v1/transactions/${id}`),
    enabled: !!id,
    refetchInterval,
  })
}

type SendRequest = {
  wallet_id: string
  token: string
  to_address: string
  amount: string // raw token units as decimal string
}

export function useSend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (req: SendRequest) =>
      apiFetch<Tx>('v1/transactions', { method: 'POST', json: req }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  })
}
