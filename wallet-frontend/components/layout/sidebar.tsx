'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Send, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const nav = [
  { href: '/dashboard', label: 'Wallets',   icon: LayoutDashboard },
  { href: '/send',      label: 'Send',      icon: Send },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-52 shrink-0 border-r border-[#ededed] bg-white h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0f5cc0] to-[#007aff] flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-white text-base font-bold tracking-tight">W</span>
        </div>
        <div>
          <p className="text-[#0c2550] font-semibold text-sm leading-none">Wallet</p>
          <p className="text-[#9aa0aa] text-xs mt-0.5">MPC-secured</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-[#ccddf9] text-[#0f5cc0]'
                  : 'text-[#9aa0aa] hover:bg-[#f5f5f5] hover:text-[#0c2550]',
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-[#ededed]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-[#9aa0aa] hover:bg-[#f5f5f5] hover:text-[#0c2550] transition-all duration-150"
        >
          <LogOut size={17} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
