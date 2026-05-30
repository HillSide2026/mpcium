const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ''

type FetchOptions = RequestInit & { json?: unknown }

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// All authenticated calls go through /api/proxy which adds the Bearer token server-side.
export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { json, ...rest } = opts
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  }

  const res = await fetch(`${API_BASE}/api/proxy/${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      msg = data.error ?? msg
    } catch {}
    throw new ApiError(res.status, msg)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}
