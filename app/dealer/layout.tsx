// app/dealer/layout.tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'
import NotificationsBell from './notifications/bell'
import {
  LayoutDashboard,
  PlusCircle,
  PackageSearch,
  CheckCircle2,
  Bell,
  Landmark,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const navItems: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: 'Dashboard', href: '/dealer', icon: LayoutDashboard },
  { label: 'In Stock', href: '/dealer/in-stock', icon: CheckCircle2 },
  { label: 'New Order', href: '/dealer/new-order', icon: PlusCircle },
  { label: 'My Orders', href: '/dealer/orders', icon: PackageSearch },
  { label: 'Wire Instructions', href: '/dealer/wire-instructions', icon: Landmark },
  { label: 'Notifications', href: '/dealer/notifications', icon: Bell },
]

function GuardAgreement() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (status !== 'authenticated') return
    if (session?.user?.role !== 'DEALER') return
    if (pathname?.startsWith('/dealer/agreement')) return

    ;(async () => {
      try {
        const res = await fetch('/api/dealer/me', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!data?.agreementSignedAt) router.push('/dealer/agreement')
      } catch {}
    })()
  }, [status, session, pathname, router])

  return null
}

export default function DealerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const Item = ({
    href,
    label,
    Icon,
  }: { href: string; label: string; Icon: LucideIcon }) => {
    const active =
      pathname === href || (href !== '/dealer' && pathname?.startsWith(href))
    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={[
          'group flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition',
          active
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-700 hover:bg-white/70',
        ].join(' ')}
      >
        <Icon
          size={18}
          className={active ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'}
        />
        <span className="font-medium">{label}</span>
      </Link>
    )
  }

  return (
    <SessionProvider>
      <GuardAgreement />
      <div
        className="min-h-screen relative flex flex-col"
        style={{
          background:
            `radial-gradient(1100px 700px at 80% 0%, rgba(35,189,215,0.20) 0%, transparent 60%),
             radial-gradient(800px 500px at 10% 90%, rgba(18,71,100,0.14) 0%, transparent 60%),
             linear-gradient(180deg, #F5FBFE 0%, #EEF8FC 100%)`,
        }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-40 backdrop-blur-md bg-white/74 border-b [border-color:var(--gg-border)]">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden -ml-1 rounded-lg p-2 hover:bg-white transition"
                onClick={() => setOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="font-black text-[18px] tracking-tight [font-family:var(--font-heading)] [color:var(--gg-navy-800)]">
                Glimmerglass • Dealer
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationsBell />
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="hidden sm:inline-flex items-center gap-2 text-[13px] font-semibold rounded-xl px-3 py-2 border bg-white hover:bg-slate-50 [border-color:var(--gg-border)]"
                title="Sign out"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[260px_1fr] gap-6 lg:min-h-[calc(100vh-4rem)] flex-1">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-20">
            <nav
              className={[
                'rounded-2xl border bg-white/88 backdrop-blur-xl p-3 shadow-[0_18px_46px_rgba(13,47,69,0.14)] [border-color:var(--gg-border)]',
                'flex flex-col justify-between',
                'lg:h-[calc(100vh-6rem)]',
                open ? 'block' : 'hidden lg:flex',
              ].join(' ')}
            >
              <div>
                <div className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.18em] [color:var(--gg-muted)]">
                  Menu
                </div>
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <Item
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      Icon={item.icon}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="h-px my-3 [background-color:var(--gg-border)]" />
                <div className="px-3 py-2 text-[12px] [color:var(--gg-muted)]">
                  Need help? <a className="underline" href="#">Support</a>
                </div>
                <div
                  className="mt-3 h-2 rounded-xl"
                  style={{ backgroundImage: 'linear-gradient(90deg, var(--gg-aqua-600), var(--gg-navy-800))' }}
                />
              </div>
            </nav>
          </aside>

          {/* Main */}
          <main className="min-w-0">
            <div className="rounded-2xl border bg-white/86 backdrop-blur-xl p-4 sm:p-6 shadow-[0_24px_64px_rgba(13,47,69,0.14)] [border-color:var(--gg-border)]">
              {children}
            </div>
          </main>
        </div>

        <div
          className="h-1 w-full"
          style={{ backgroundImage: 'linear-gradient(90deg, var(--gg-aqua-600), var(--gg-navy-800))' }}
        />
      </div>
    </SessionProvider>
  )
}
