import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

const GO_API = process.env.GO_API_URL ?? 'http://localhost:8080'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('wallet_token')?.value

  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const upstream = await fetch(`${GO_API}/api/v1/events`, {
    headers: { Authorization: `Bearer ${token}` },
    // Keep the connection alive for SSE
    signal: req.signal,
  })

  if (!upstream.ok || !upstream.body) {
    return new Response('SSE upstream unavailable', { status: 502 })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
