import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

type NodeInfo = { name: string; status: 'online' | 'unknown' }

type ClusterHealth = {
  nodes: NodeInfo[]
  threshold: number
  total: number
  healthy: boolean
}

export function useClusterHealth() {
  return useQuery<ClusterHealth>({
    queryKey: ['cluster-health'],
    queryFn: () => apiFetch('v1/health/cluster'),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}
