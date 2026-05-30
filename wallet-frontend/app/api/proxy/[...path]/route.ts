import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

const GO_API = process.env.GO_API_URL ?? 'http://localhost:8080'

async function proxy(req: NextRequest, params: Promise<{ path: string[] }>) {
  const { path } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('wallet_token')?.value

  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(`${GO_API}/api/${path.join('/')}`)
  // Forward query params
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v))

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const upstream = await fetch(url.toString(), {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    // Required to stream the body through
    duplex: 'half',
  } as RequestInit)

  const data = await upstream.text()

  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  proxy(req, ctx.params)
export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  proxy(req, ctx.params)
export const PUT = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  proxy(req, ctx.params)
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  proxy(req, ctx.params)
