'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Registration failed'); return }
      toast.success('Account created')
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error — is the wallet API running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="text-center space-y-3">
        <div
          className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0f5cc0 0%, #007aff 100%)' }}
        >
          <span className="text-white text-2xl font-bold">W</span>
        </div>
        <div>
          <h1 className="text-[#0c2550] text-2xl font-bold">Create account</h1>
          <p className="text-[#9aa0aa] text-sm mt-0.5">MPC-secured stablecoin wallet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-[#d0021b] bg-[#f8d2d2] rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[#0c2550] text-sm font-medium">Email</Label>
          <Input
            id="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-[#f5f5f5] border-[#ededed] rounded-xl focus:border-[#007aff] text-[#0c2550]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[#0c2550] text-sm font-medium">Password</Label>
          <Input
            id="password" type="password" autoComplete="new-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="8+ characters"
            className="bg-[#f5f5f5] border-[#ededed] rounded-xl focus:border-[#007aff] text-[#0c2550]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-2xl text-white font-semibold text-base flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-70 mt-2"
          style={{ background: 'linear-gradient(135deg, #0f5cc0 0%, #007aff 100%)' }}
        >
          {loading ? <><Loader2 size={16} className="animate-spin" />Creating account…</> : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-[#9aa0aa]">
        Already have an account?{' '}
        <Link href="/login" className="text-[#007aff] font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
