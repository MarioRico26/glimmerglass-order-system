// app/(admin)/layout.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { signOut } from 'next-auth/react'

import AdminAlertsBell from './notifications/bell'

import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Factory,
  BookOpen,
  Palette,
  ChevronDown,
  UserCog,
  Boxes,
  SlidersHorizontal,
  PlusCircle,
  Warehouse,
  Menu,
  X,
  CalendarDays,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  label: string
  href: string
  icon?: LucideIcon
  badge?: string
  module?: string
}

type AccessSummary = {
  role?: 'ADMIN' | 'SUPERADMIN'
  allModules: boolean
  effectiveModules: string[]
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

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [access, setAccess] = useState<AccessSummary | null>(null)
  const [loadingAccess, setLoadingAccess] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/admin/access', { cache: 'no-store' })
        const data = await res.json().catch(() => null)
        if (!active) return
        if (res.ok) setAccess(data)
        else setAccess(null)
      } catch {
        if (active) setAccess(null)
      } finally {
        if (active) setLoadingAccess(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const hasModule = (module?: string) => {
    if (!module) return true
    if (!access || access.allModules) return true
    return access.effectiveModules.includes(module)
  }

  const canSeeUsersModule = () => {
    if (!hasModule('USERS')) return false
    return access?.role === 'SUPERADMIN'
  }

  const sections = useMemo<NavSection[]>(
    () => {
      const all: NavSection[] = [
        {
          type: 'link',
          item: { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, module: 'DASHBOARD' },
        },
        {
          type: 'group',
          label: 'Orders',
          icon: ClipboardList,
          defaultOpen: true,
          items: [
            { label: 'Order List', href: '/admin/orders', icon: ClipboardList, module: 'ORDER_LIST' },
            { label: 'New Order', href: '/admin/orders/new', icon: PlusCircle, module: 'NEW_ORDER' },
            { label: 'Production Schedule', href: '/admin/production', icon: Factory, module: 'PRODUCTION_SCHEDULE' },
            { label: 'Ship Schedule', href: '/admin/shipping', icon: CalendarDays, module: 'SHIP_SCHEDULE' },
            { label: 'Workflow Requirements', href: '/admin/order-flow', icon: ClipboardList, module: 'WORKFLOW_REQUIREMENTS' },
          ],
        },
        {
          type: 'group',
          label: 'Inventory',
          icon: Warehouse,
          defaultOpen: true,
          items: [
            { label: 'Pool Stock', href: '/admin/pool-stock', icon: Factory, module: 'POOL_STOCK' },
            { label: 'Daily Sheet', href: '/admin/inventory/daily', icon: Boxes, module: 'INVENTORY' },
            { label: 'Master Setup', href: '/admin/inventory/master', icon: SlidersHorizontal, module: 'INVENTORY' },
          ],
        },
        {
          type: 'group',
          label: 'Catalog',
          icon: BookOpen,
          defaultOpen: true,
          items: [
            { label: 'Pool Models', href: '/admin/catalog/pool-models', icon: BookOpen, module: 'POOL_CATALOG' },
            { label: 'Pool Colors', href: '/admin/catalog/colors', icon: Palette, module: 'POOL_CATALOG' },
          ],
        },
        {
          type: 'group',
          label: 'People',
          icon: Users,
          defaultOpen: true,
          items: [
            { label: 'Dealers', href: '/admin/dealers', icon: Users, module: 'DEALERS' },
            { label: 'Users', href: '/admin/users', icon: UserCog, module: 'USERS' },
          ],
        },
      ]

      return all
        .map((section) => {
          if (section.type === 'link') {
            return hasModule(section.item.module) ? section : null
          }
          const items = section.items.filter((item) => {
            if (item.module === 'USERS') return canSeeUsersModule()
            return hasModule(item.module)
          })
          return items.length ? { ...section, items } : null
        })
        .filter(Boolean) as NavSection[]
    },
    [access],
  )

  const isActive = (href: string) => pathname === href || (href !== '/admin' && pathname?.startsWith(href + '/')) || (href !== '/admin' && pathname?.startsWith(href))

  return (
    <aside className="lg:sticky lg:top-20">
      <nav className="rounded-2xl border bg-white/88 backdrop-blur-xl p-3 lg:h-[calc(100vh-6rem)] lg:max-h-[calc(100vh-6rem)] overflow-y-auto flex flex-col justify-between shadow-[0_18px_46px_rgba(13,47,69,0.14)] [border-color:var(--gg-border)]">
        <div>
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.18em] [color:var(--gg-muted)]">
            Admin Menu
          </div>

          <div className="space-y-1">
            {loadingAccess ? (
              <div className="space-y-2 px-2 py-2">
                <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
                <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
                <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
              </div>
            ) : sections.map((sec, idx) => {
              if (sec.type === 'link') {
                return <NavLink key={sec.item.href} item={sec.item} active={isActive(sec.item.href)} onNavigate={onNavigate} />
              }

              return <NavGroup key={`${sec.label}-${idx}`} section={sec} isActive={isActive} onNavigate={onNavigate} />
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

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={[
        'group flex items-center justify-between rounded-xl px-3 py-2 text-[14px] transition',
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
  onNavigate,
}: {
  section: Extract<NavSection, { type: 'group' }>
  isActive: (href: string) => boolean
  onNavigate?: () => void
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
            <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <SessionProvider>
      <div
        className="min-h-screen relative flex flex-col print:bg-white"
        style={{
          background:
            `radial-gradient(1100px 700px at 80% 0%, rgba(35,189,215,0.20) 0%, transparent 60%),
             radial-gradient(800px 500px at 10% 90%, rgba(18,71,100,0.14) 0%, transparent 60%),
             linear-gradient(180deg, #F5FBFE 0%, #EEF8FC 100%)`,
        }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-40 backdrop-blur-md bg-white/74 border-b [border-color:var(--gg-border)] print:hidden">
          <div className="w-full px-5 xl:px-6 2xl:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden -ml-1 rounded-lg p-2 hover:bg-white transition"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Toggle admin menu"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="font-black text-[16px] tracking-tight [font-family:var(--font-heading)] [color:var(--gg-navy-800)]">
                Glimmerglass FiberGlass Pools • Admin • Portal
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AdminAlertsBell />
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

        <div className="w-full px-5 xl:px-6 2xl:px-8 py-6 grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6 lg:min-h-[calc(100vh-4rem)] flex-1 print:block print:px-0 print:py-0">
          <div className={`${menuOpen ? 'block lg:block' : 'hidden lg:block'} print:hidden`}>
            <AdminNav onNavigate={() => setMenuOpen(false)} />
          </div>
          <main className="min-w-0 text-[15px] leading-[1.45]">
            <div className="rounded-2xl border bg-white/86 backdrop-blur-xl p-4 sm:p-6 shadow-[0_24px_64px_rgba(13,47,69,0.14)] [border-color:var(--gg-border)] print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none">
              {children}
            </div>
          </main>
        </div>

        <div
          className="h-1 w-full print:hidden"
          style={{ backgroundImage: 'linear-gradient(90deg, var(--gg-aqua-600), var(--gg-navy-800))' }}
        />
      </div>
    </SessionProvider>
  )
}
