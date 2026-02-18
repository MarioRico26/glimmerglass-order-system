// app/(admin)/layout.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useMemo, useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { signOut } from 'next-auth/react'

import NotificationsBell from '../dealer/notifications/bell'

import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Factory,
  BookOpen,
  Palette,
  ChevronDown,
  Shield,
  UserCog,
  Boxes,
  PackageCheck,
  SlidersHorizontal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  label: string
  href: string
  icon?: LucideIcon
  badge?: string
}

type NavSection =
  | { type: 'link'; item: NavItem }
  | {
      type: 'group'
      label: string
      icon?: LucideIcon
      defaultOpen?: boolean
      items: NavItem[]
    }

function AdminNav() {
  const pathname = usePathname()

  const sections = useMemo<NavSection[]>(
    () => [
      {
        type: 'group',
        label: 'Operations',
        icon: PackageCheck,
        defaultOpen: true,
        items: [
          { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
          { label: 'Orders', href: '/admin/orders', icon: ClipboardList },
          { label: 'Production Board', href: '/admin/production', icon: Factory },
          { label: 'Pool Stock', href: '/admin/pool-stock', icon: Factory },
          { label: 'Inventory', href: '/admin/inventory/daily', icon: Boxes },
          { label: 'Inventory Setup', href: '/admin/inventory/master', icon: SlidersHorizontal },
        ],
      },

      // --- Catalog group ---
      {
        type: 'group',
        label: 'Catalog',
        icon: BookOpen,
        defaultOpen: true,
        items: [
          { label: 'Pool Models', href: '/admin/catalog/pool-models', icon: BookOpen },
          { label: 'Pool Colors', href: '/admin/catalog/colors', icon: Palette },
        ],
      },

      {
        type: 'group',
        label: 'People',
        icon: Users,
        defaultOpen: true,
        items: [
          { label: 'Dealers', href: '/admin/dealers', icon: Users },
        ],
      },

      // --- System ---
      {
        type: 'group',
        label: 'System',
        icon: Shield,
        defaultOpen: false,
        items: [
          { label: 'Users', href: '/admin/users', icon: UserCog },
          // reservado para futuros ajustes globales
          // { label: 'Settings', href: '/admin/settings', icon: Settings },
        ],
      },
    ],
    [],
  )

  const isActive = (href: string) => pathname === href || (href !== '/admin' && pathname?.startsWith(href + '/')) || (href !== '/admin' && pathname?.startsWith(href))

  return (
    <aside className="lg:sticky lg:top-20">
      <nav className="rounded-2xl border bg-white/88 backdrop-blur-xl p-3 lg:h-[calc(100vh-6rem)] flex flex-col justify-between shadow-[0_18px_46px_rgba(13,47,69,0.14)] [border-color:var(--gg-border)]">
        <div>
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.18em] [color:var(--gg-muted)]">
            Admin Menu
          </div>

          <div className="space-y-1">
            {sections.map((sec, idx) => {
              if (sec.type === 'link') {
                return <NavLink key={sec.item.href} item={sec.item} active={isActive(sec.item.href)} />
              }

              return <NavGroup key={`${sec.label}-${idx}`} section={sec} isActive={isActive} />
            })}
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
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={[
        'group flex items-center justify-between rounded-xl px-3 py-2 text-[15px] transition',
        active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70' : 'text-slate-700 hover:bg-white/70',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span
            className={[
              'grid h-9 w-9 place-items-center rounded-xl transition shrink-0',
              active
                ? '[background-color:var(--gg-seafoam-100)] [color:var(--gg-navy-800)]'
                : 'bg-slate-100 text-slate-600 group-hover:[background-color:var(--gg-seafoam-100)] group-hover:[color:var(--gg-navy-800)]',
            ].join(' ')}
          >
            <Icon size={18} />
          </span>
        )}
        <span className="font-semibold truncate">{item.label}</span>
      </div>

      {item.badge && (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

function NavGroup({
  section,
  isActive,
}: {
  section: Extract<NavSection, { type: 'group' }>
  isActive: (href: string) => boolean
}) {
  const Icon = section.icon
  const anyChildActive = section.items.some((i) => isActive(i.href))
  const [open, setOpen] = useState(section.defaultOpen ?? anyChildActive)

  return (
    <div className="rounded-2xl border bg-white/66 overflow-hidden [border-color:var(--gg-border)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          'w-full flex items-center justify-between px-3 py-2 text-[13px] font-extrabold uppercase tracking-wide transition',
          anyChildActive ? 'text-slate-900 bg-white/70' : 'text-slate-600 hover:bg-white/70',
        ].join(' ')}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={['grid h-8 w-8 place-items-center rounded-xl', anyChildActive ? '[background-color:var(--gg-seafoam-100)] [color:var(--gg-navy-800)]' : 'bg-slate-100 text-slate-600'].join(' ')}>
              <Icon size={16} />
            </span>
          )}
          <span>{section.label}</span>
        </div>
        <ChevronDown size={16} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-1">
          {section.items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
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
            <div className="font-black text-[18px] tracking-tight [font-family:var(--font-heading)] [color:var(--gg-navy-800)]">
              Glimmerglass FiberGlass Pools • Admin • Portal
            </div>
            <div className="flex items-center gap-3">
              <NotificationsBell />
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="hidden sm:inline-flex items-center gap-2 text-[13px] font-semibold rounded-xl px-3 py-2 border bg-white hover:bg-slate-50 [border-color:var(--gg-border)]"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[280px_1fr] gap-6 lg:min-h-[calc(100vh-4rem)] flex-1">
          <AdminNav />
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
