import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

const GO_API = process.env.GO_API_URL ?? 'http://localhost:8080'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const upstream = await fetch(`${GO_API}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await upstream.json()

  if (!upstream.ok) {
    return Response.json({ error: data.error ?? 'Registration failed' }, { status: upstream.status })
  }

  const cookieStore = await cookies()
  cookieStore.set('wallet_token', data.access_token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: data.expires_in ?? 86400,
  })

  return Response.json({ ok: true })
}
