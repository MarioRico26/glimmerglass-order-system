// app/(admin)/layout.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useMemo } from 'react'
import { SessionProvider } from 'next-auth/react'
import NotificationsBell from '../dealer/notifications/bell'
import { signOut } from 'next-auth/react'

function AdminNav() {
  const pathname = usePathname()

  const navItems = useMemo(
    () => [
      { label: 'Dashboard', href: '/admin' },
      { label: 'Orders', href: '/admin/orders' },
      { label: 'Dealers', href: '/admin/dealers' },
      { label: 'Catalog: Pool Models', href: '/admin/catalog/pool-models' },
      { label: 'Catalog: Pool Colors', href: '/admin/catalog/colors' },
      { label: 'Board', href: '/admin/board' },
      { label: 'Users', href: '/admin/users' },
    ],
    [],
  )

  return (
    <aside className="lg:sticky lg:top-20">
      <nav className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.12)] p-3 lg:h-[calc(100vh-6rem)] flex flex-col justify-between">
        <div>
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Admin Menu
          </div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'group flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition',
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-700 hover:bg-white/70',
                  ].join(' ')}
                >
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="h-px my-3 bg-slate-200/60" />
          <div className="px-3 py-2 text-[12px] text-slate-500">
            Need help? <a className="underline" href="#">Support</a>
          </div>
          <div
            className="mt-3 h-2 rounded-xl"
            style={{ backgroundImage: 'linear-gradient(90deg, #00B2CA, #007A99)' }}
          />
        </div>
      </nav>
    </aside>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <div
        className="min-h-screen relative flex flex-col"
        style={{
          background:
            `radial-gradient(1100px 700px at 80% 0%, #E6F7FA 0%, transparent 60%),
             radial-gradient(800px 500px at 10% 90%, rgba(0,178,202,0.10) 0%, transparent 60%),
             linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)`,
        }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-40 backdrop-blur-md bg-white/60 border-b border-white/70">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="font-black text-[18px]" style={{ color: '#007A99' }}>
              Glimmerglass FiberGlass Pools • Admin • Portal
            </div>
            <div className="flex items-center gap-3">
              <NotificationsBell />
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="hidden sm:inline-flex items-center gap-2 text-[13px] font-semibold rounded-xl px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[260px_1fr] gap-6 lg:min-h-[calc(100vh-4rem)] flex-1">
          <AdminNav />
          <main className="min-w-0">
            <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-4 sm:p-6">
              {children}
            </div>
          </main>
        </div>

        <div
          className="h-1 w-full"
          style={{ backgroundImage: 'linear-gradient(90deg, #00B2CA, #007A99)' }}
        />
      </div>
    </SessionProvider>
  )
} 