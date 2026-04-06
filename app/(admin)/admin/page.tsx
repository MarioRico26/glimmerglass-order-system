'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CircleCheckBig,
  CircleX,
  Clock3,
  Factory,
  PackageSearch,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  Cell,
} from 'recharts'

type FactoryRow = {
  factoryId: string
  factoryName: string
  totals: Record<string, number>
}

type Metrics = {
  totals: Record<string, number>
  signals: {
    missingSerial: number
    unscheduledProduction: number
    unscheduledShipping: number
    finalPaymentNeeded: number
    allocatedStock: number
    allocatedStockNoShip: number
    overdueRequestedShip: number
    asapRequests: number
  }
  monthly: { key: string; label: string; count: number }[]
  statusTrend: {
    key: string
    label: string
    needsDeposit: number
    production: number
    preShipping: number
    finalPaymentNeeded: number
  }[]
  recent: { id: string; dealer: string; model: string; color: string; factory: string; status: string; createdAt: string }[]
  byFactory: FactoryRow[]
}

type PoolStockSummary = {
  factoryId: string
  factoryName: string
  totals: {
    READY: number
    RESERVED: number
    IN_PRODUCTION: number
    DAMAGED: number
  }
}

type AccessSummary = {
  allModules: boolean
  effectiveModules: string[]
  allFactories: boolean
  factories: { id: string; name: string }[]
}

const emptyMetrics: Metrics = {
  totals: { total: 0, PENDING_PAYMENT_APPROVAL: 0, IN_PRODUCTION: 0, PRE_SHIPPING: 0, COMPLETED: 0, SERVICE_WARRANTY: 0, CANCELED: 0 },
  signals: {
    missingSerial: 0,
    unscheduledProduction: 0,
    unscheduledShipping: 0,
    finalPaymentNeeded: 0,
    allocatedStock: 0,
    allocatedStockNoShip: 0,
    overdueRequestedShip: 0,
    asapRequests: 0,
  },
  monthly: [],
  statusTrend: [],
  recent: [],
  byFactory: [],
}

function statusLabel(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL':
      return 'Needs Deposit'
    case 'IN_PRODUCTION':
      return 'In Production'
    case 'PRE_SHIPPING':
      return 'Pre-Shipping'
    case 'COMPLETED':
      return 'Completed'
    case 'SERVICE_WARRANTY':
      return 'Service/Warranty'
    case 'CANCELED':
      return 'Canceled'
    default:
      return status.replaceAll('_', ' ')
  }
}

function statusPill(status: string) {
  const base = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold'
  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL':
      return <span className={`${base} border-amber-200 bg-amber-50 text-amber-800`}>Needs Deposit</span>
    case 'IN_PRODUCTION':
      return <span className={`${base} border-indigo-200 bg-indigo-50 text-indigo-800`}>In Production</span>
    case 'PRE_SHIPPING':
      return <span className={`${base} border-violet-200 bg-violet-50 text-violet-800`}>Pre-Shipping</span>
    case 'COMPLETED':
      return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}>Completed</span>
    case 'SERVICE_WARRANTY':
      return <span className={`${base} border-cyan-200 bg-cyan-50 text-cyan-800`}>Service/Warranty</span>
    case 'CANCELED':
      return <span className={`${base} border-rose-200 bg-rose-50 text-rose-800`}>Canceled</span>
    default:
      return <span className={`${base} border-slate-200 bg-slate-50 text-slate-700`}>{statusLabel(status)}</span>
  }
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics)
  const [loading, setLoading] = useState(true)
  const [poolStock, setPoolStock] = useState<PoolStockSummary[]>([])
  const [access, setAccess] = useState<AccessSummary | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [selectedFactoryId, setSelectedFactoryId] = useState('ALL')

  useEffect(() => {
    if (status === 'loading') return
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      router.push('/login')
      return
    }
    ;(async () => {
      try {
        const [accessRes, metricsRes, stockRes] = await Promise.all([
          fetch('/api/admin/access?module=DASHBOARD', { cache: 'no-store' }),
          fetch(`/api/admin/metrics${selectedFactoryId !== 'ALL' ? `?factoryId=${selectedFactoryId}` : ''}`, { cache: 'no-store' }),
          fetch(
            `/api/admin/pool-stock/summary?scopeModule=DASHBOARD${
              selectedFactoryId !== 'ALL' ? `&factoryId=${selectedFactoryId}` : ''
            }`,
            { cache: 'no-store' }
          ),
        ])

        const accessData = await accessRes.json().catch(() => null)
        const metricsData = await metricsRes.json().catch(() => null)
        const stockData = await stockRes.json().catch(() => null)

        if (accessRes.status === 403) {
          setAccessDenied(true)
          setMetrics(emptyMetrics)
          setPoolStock([])
          setAccess(null)
          return
        }

        if (accessRes.ok) setAccess(accessData)
        else setAccess(null)

        if (metricsRes.ok) setMetrics(metricsData)
        else setMetrics(emptyMetrics)

        setPoolStock(Array.isArray(stockData?.items) ? stockData.items : [])
      } catch {
        setMetrics(emptyMetrics)
        setPoolStock([])
      } finally {
        setLoading(false)
      }
    })()
  }, [session, status, router, selectedFactoryId])

  useEffect(() => {
    if (!access) return
    if (access.allFactories) return
    if (access.factories.length === 1) {
      setSelectedFactoryId(access.factories[0].id)
    }
  }, [access])

  const aqua = '#00B2CA'
  const deep = '#007A99'
  const t = useMemo(() => metrics.totals, [metrics])
  const signals = useMemo(() => metrics.signals, [metrics])
  const poolStockTotals = useMemo(() => {
    return poolStock.reduce(
      (acc, row) => {
        acc.READY += row.totals.READY || 0
        acc.RESERVED += row.totals.RESERVED || 0
        acc.IN_PRODUCTION += row.totals.IN_PRODUCTION || 0
        acc.DAMAGED += row.totals.DAMAGED || 0
        return acc
      },
      { READY: 0, RESERVED: 0, IN_PRODUCTION: 0, DAMAGED: 0 }
    )
  }, [poolStock])

  const factoryLoadData = useMemo(
    () =>
      metrics.byFactory.map((f) => ({
        name: f.factoryName,
        production: f.totals.IN_PRODUCTION || 0,
        preShipping: f.totals.PRE_SHIPPING || 0,
        needsDeposit: f.totals.PENDING_PAYMENT_APPROVAL || 0,
      })),
    [metrics.byFactory]
  )
  const riskSnapshotData = useMemo(
    () => [
      { label: 'Final Payment', value: signals.finalPaymentNeeded, fill: '#e11d48' },
      { label: 'Overdue Ship', value: signals.overdueRequestedShip, fill: '#f59e0b' },
      { label: 'Missing Serial', value: signals.missingSerial, fill: '#f59e0b' },
      { label: 'Prod. Unscheduled', value: signals.unscheduledProduction, fill: '#6366f1' },
      { label: 'Ship Unscheduled', value: signals.unscheduledShipping, fill: '#0ea5e9' },
      { label: 'Stock / No Ship', value: signals.allocatedStockNoShip, fill: '#0f766e' },
    ],
    [signals]
  )

  const factoryOptions = useMemo(() => {
    if (access?.allFactories) {
      const pairs = new Map<string, string>()
      metrics.byFactory.forEach((row) => pairs.set(row.factoryId, row.factoryName))
      poolStock.forEach((row) => pairs.set(row.factoryId, row.factoryName))
      return Array.from(pairs.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }
    return access?.factories ?? []
  }, [access, metrics.byFactory, poolStock])

  const selectedFactoryName =
    selectedFactoryId === 'ALL'
      ? access?.allFactories || (access?.factories?.length || 0) > 1
        ? 'All accessible factories'
        : 'All factories'
      : factoryOptions.find((factory) => factory.id === selectedFactoryId)?.name || 'Selected factory'

  const orderListHref = (params: Record<string, string>) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value)
    })
    if (selectedFactoryId !== 'ALL') {
      const factoryName = factoryOptions.find((factory) => factory.id === selectedFactoryId)?.name
      if (factoryName) query.set('factory', factoryName)
    }
    return `/admin/orders${query.toString() ? `?${query.toString()}` : ''}`
  }

  const actionLinks = [
    { label: 'Order List', href: '/admin/orders', Icon: PackageSearch, tone: 'slate', module: 'ORDER_LIST' },
    { label: 'Production Schedule', href: '/admin/production', Icon: Factory, tone: 'indigo', module: 'PRODUCTION_SCHEDULE' },
    { label: 'Ship Schedule', href: '/admin/shipping', Icon: CalendarDays, tone: 'sky', module: 'SHIP_SCHEDULE' },
    { label: 'Pool Stock', href: '/admin/pool-stock', Icon: Boxes, tone: 'emerald', module: 'POOL_STOCK' },
  ] as const

  const visibleActionLinks = access?.allModules || !access
    ? actionLinks
    : actionLinks.filter((item) => access.effectiveModules.includes(item.module))

  if (loading) return <div className="p-2 text-slate-600">Loading…</div>
  if (accessDenied) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <h1 className="text-2xl font-black">Dashboard access denied</h1>
        <p className="mt-2 text-sm">This user does not currently have access to the dashboard module.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white bg-white/82 p-6 xl:p-7 shadow-[0_24px_64px_rgba(13,47,69,0.14)] backdrop-blur-xl">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px] xl:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-slate-700">
              OPERATIONS OVERVIEW
            </div>
            <h1 className="mt-3 text-3xl xl:text-[3.4rem] leading-none font-black text-slate-900">
              Admin Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-600 xl:text-[17px]">
              Live operational snapshot across orders, production, shipping, and finished pool stock.
            </p>
            <p className="mt-1 text-[13px] text-slate-500">
              Signed in as {session?.user?.email} ({session?.user?.role})
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm">
                Factory Scope:
                <span className="ml-2 font-black text-slate-900">{selectedFactoryName}</span>
              </span>
              {!access?.allFactories && access?.factories?.length === 1 ? (
                <span className="inline-flex items-center rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 font-semibold text-sky-800 shadow-sm">
                  Restricted to one plant
                </span>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {visibleActionLinks.map(({ label, href, Icon, tone }) => (
                <QuickAction key={href} label={label} href={href} Icon={Icon} tone={tone} />
              ))}
            </div>
          </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.22)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">Operations Pulse</div>
              <select
                value={selectedFactoryId}
                onChange={(e) => setSelectedFactoryId(e.target.value)}
                className="h-9 min-w-[220px] rounded-2xl border border-white/10 bg-white/10 px-4 text-[13px] font-semibold text-white outline-none"
                disabled={!access?.allFactories && (access?.factories?.length ?? 0) <= 1}
              >
                {(access?.allFactories || (access?.factories?.length ?? 0) > 1) && (
                  <option value="ALL" className="text-slate-900">
                    All accessible factories
                  </option>
                )}
                {factoryOptions.map((factory) => (
                  <option key={factory.id} value={factory.id} className="text-slate-900">
                    {factory.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <PulseRow label="Needs Deposit" value={t.PENDING_PAYMENT_APPROVAL || 0} tone="amber" />
              <PulseRow label="In Production" value={t.IN_PRODUCTION || 0} tone="indigo" />
              <PulseRow label="Pre-Shipping" value={t.PRE_SHIPPING || 0} tone="violet" />
              <PulseRow label="Service/Warranty" value={t.SERVICE_WARRANTY || 0} tone="sky" />
              <PulseRow label="Ready Pool Stock" value={poolStockTotals.READY || 0} tone="emerald" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-6">
        <StatCard label="Total Orders" value={t.total || 0} Icon={PackageSearch} tone="slate" />
        <StatCard
          label="Needs Deposit"
          value={t.PENDING_PAYMENT_APPROVAL || 0}
          Icon={Clock3}
          tone="amber"
          trend={metrics.statusTrend}
          trendKey="needsDeposit"
        />
        <StatCard
          label="In Production"
          value={t.IN_PRODUCTION || 0}
          Icon={CircleCheckBig}
          tone="indigo"
          trend={metrics.statusTrend}
          trendKey="production"
        />
        <StatCard
          label="Pre-Shipping"
          value={t.PRE_SHIPPING || 0}
          Icon={Truck}
          tone="violet"
          trend={metrics.statusTrend}
          trendKey="preShipping"
        />
        <StatCard label="Completed" value={t.COMPLETED || 0} Icon={CheckCircle2} tone="emerald" />
        <StatCard label="Service/Warranty" value={t.SERVICE_WARRANTY || 0} Icon={CircleAlert} tone="sky" />
      </section>

      <section className="rounded-[1.75rem] border border-white bg-white/82 p-5 shadow-[0_18px_50px_rgba(13,47,69,0.10)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Action Center</div>
            <h2 className="mt-1 text-xl font-black text-slate-900">Needs Attention</h2>
          </div>
          <Link
            href={orderListHref({})}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
          >
            Open Order List <ArrowRight size={15} />
          </Link>
        </div>
        <div className="space-y-5">
          <ActionGroup
            title="Critical"
            detail="Issues that usually block shipping or create immediate customer pressure."
            cards={[
              {
                label: 'Final Payment Needed',
                value: signals.finalPaymentNeeded,
                detail: 'Pre-Shipping orders missing proof of final payment.',
                href: orderListHref({ status: 'PRE_SHIPPING', finalPayment: 'NEEDED' }),
                tone: 'rose',
              },
              {
                label: 'Overdue Requested Ship',
                value: signals.overdueRequestedShip,
                detail: 'Open orders where the requested ship date is already behind.',
                href: orderListHref({ signal: 'OVERDUE_REQUESTED_SHIP' }),
                tone: 'amber',
              },
              {
                label: 'Stock Reserved / No Ship Date',
                value: signals.allocatedStockNoShip,
                detail: 'Reserved stock that still has no scheduled ship date.',
                href: orderListHref({ signal: 'ALLOCATED_STOCK_NO_SHIP' }),
                tone: 'indigo',
              },
            ]}
          />

          <ActionGroup
            title="Attention"
            detail="Open operational gaps that should be closed before orders move deeper into the workflow."
            cards={[
              {
                label: 'Missing Serial',
                value: signals.missingSerial,
                detail: 'Active orders missing a serial number.',
                href: orderListHref({ signal: 'MISSING_SERIAL' }),
                tone: 'amber',
              },
              {
                label: 'Unscheduled Production',
                value: signals.unscheduledProduction,
                detail: 'In Production orders without a production date.',
                href: orderListHref({ signal: 'UNSCHEDULED_PRODUCTION' }),
                tone: 'indigo',
              },
              {
                label: 'Unscheduled Shipping',
                value: signals.unscheduledShipping,
                detail: 'Pre-Shipping orders without a ship date.',
                href: orderListHref({ signal: 'UNSCHEDULED_SHIPPING' }),
                tone: 'sky',
              },
            ]}
          />

          <ActionGroup
            title="Operational"
            detail="Useful active views for dispatching work across ops, production, and admin."
            cards={[
              {
                label: 'Needs Deposit',
                value: t.PENDING_PAYMENT_APPROVAL || 0,
                detail: 'Orders still waiting on deposit-side progress.',
                href: orderListHref({ signal: 'NEEDS_DEPOSIT_FILE' }),
                tone: 'sky',
              },
              {
                label: 'ASAP Requests',
                value: signals.asapRequests,
                detail: 'Open orders flagged for ASAP requested ship date.',
                href: orderListHref({ signal: 'ASAP_REQUESTS' }),
                tone: 'violet',
              },
              {
                label: 'Allocated Stock',
                value: signals.allocatedStock,
                detail: 'Orders already tied to finished pool stock.',
                href: orderListHref({ signal: 'ALLOCATED_STOCK' }),
                tone: 'emerald',
              },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-[1.75rem] border border-white bg-white/82 p-5 shadow-[0_18px_50px_rgba(13,47,69,0.10)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Volume</div>
              <h2 className="mt-1 text-xl font-black text-slate-900">Orders Last 6 Months</h2>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.monthly}>
                <defs>
                  <linearGradient id="gradAdmin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={aqua} stopOpacity={0.82} />
                    <stop offset="100%" stopColor={deep} stopOpacity={0.18} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6eef2" />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke={deep} strokeWidth={2.5} fill="url(#gradAdmin)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white bg-white/82 p-5 shadow-[0_18px_50px_rgba(13,47,69,0.10)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Recent Activity</div>
              <h2 className="mt-1 text-xl font-black text-slate-900">Latest Orders</h2>
            </div>
            <Link href="/admin/orders" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50">
              Open Orders <ArrowRight size={15} />
            </Link>
          </div>
          {metrics.recent.length === 0 ? (
            <div className="text-slate-500">No recent orders.</div>
          ) : (
            <div className="space-y-3">
              {metrics.recent.map((o) => (
                <Link key={o.id} href={`/admin/orders/${o.id}/history`} className="block rounded-2xl border border-slate-200 bg-white/90 p-4 transition hover:border-sky-200 hover:shadow-[0_12px_30px_rgba(2,132,199,0.08)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-extrabold text-slate-900">{o.model} • {o.color}</div>
                      <div className="mt-1 truncate text-[13px] text-slate-600">{o.dealer} • {o.factory}</div>
                      <div className="mt-1 text-[12px] text-slate-500">{new Date(o.createdAt).toLocaleString()}</div>
                    </div>
                    {statusPill(o.status)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-[1.75rem] border border-white bg-white/82 p-5 shadow-[0_18px_50px_rgba(13,47,69,0.10)] backdrop-blur-xl">
          <div className="mb-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Factory Load</div>
            <h2 className="mt-1 text-xl font-black text-slate-900">Orders by Factory Stage</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={factoryLoadData} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6eef2" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#475569', fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="production" name="In Production" fill="#6366f1" radius={[0, 6, 6, 0]} />
                <Bar dataKey="preShipping" name="Pre-Shipping" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                <Bar dataKey="needsDeposit" name="Needs Deposit" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white bg-white/82 p-5 shadow-[0_18px_50px_rgba(13,47,69,0.10)] backdrop-blur-xl">
          <div className="mb-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Risk Snapshot</div>
            <h2 className="mt-1 text-xl font-black text-slate-900">Current Operational Pressure</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskSnapshotData} layout="vertical" margin={{ left: 18, right: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6eef2" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
                <YAxis dataKey="label" type="category" width={120} tick={{ fill: '#475569', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 7, 7, 0]}>
                  {riskSnapshotData.map((entry) => (
                    <CellBar key={entry.label} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-[1.75rem] border border-white bg-white/82 p-5 shadow-[0_18px_50px_rgba(13,47,69,0.10)] backdrop-blur-xl">
          <div className="mb-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Flow Trends</div>
            <h2 className="mt-1 text-xl font-black text-slate-900">Weekly Workflow Pressure</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.statusTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6eef2" />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="needsDeposit" name="Needs Deposit" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="production" name="In Production" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="preShipping" name="Pre-Shipping" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="finalPaymentNeeded" name="Final Payment Needed" stroke="#e11d48" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white bg-white/82 p-5 shadow-[0_18px_50px_rgba(13,47,69,0.10)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Finished Pools</div>
              <h2 className="mt-1 text-xl font-black text-slate-900">Pool Stock Snapshot</h2>
            </div>
            <Link href="/admin/pool-stock" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50">
              Open Pool Stock <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SnapshotCard label="Ready" value={poolStockTotals.READY} tone="emerald" />
            <SnapshotCard label="Reserved" value={poolStockTotals.RESERVED} tone="amber" />
            <SnapshotCard label="In Production" value={poolStockTotals.IN_PRODUCTION} tone="indigo" />
            <SnapshotCard label="Damaged" value={poolStockTotals.DAMAGED} tone="rose" />
          </div>

          <div className="mt-5 space-y-2">
            {poolStock.map((row) => (
              <div key={row.factoryId} className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-extrabold text-slate-900">{row.factoryName}</div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">Ready {row.totals.READY}</span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">Reserved {row.totals.RESERVED}</span>
                  </div>
                </div>
              </div>
            ))}
            {poolStock.length === 0 && <div className="text-slate-500">No stock data.</div>}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white bg-white/82 p-5 shadow-[0_18px_50px_rgba(13,47,69,0.10)] backdrop-blur-xl">
        <div className="mb-4">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Factory Detail</div>
          <h2 className="mt-1 text-xl font-black text-slate-900">By Factory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="text-left py-2 pr-4">Factory</th>
                <th className="text-right py-2 px-3">Total</th>
                <th className="text-right py-2 px-3">Needs Deposit</th>
                <th className="text-right py-2 px-3">In Production</th>
                <th className="text-right py-2 px-3">Pre-Shipping</th>
                <th className="text-right py-2 px-3">Completed</th>
                <th className="text-right py-2 px-3">Service/Warranty</th>
                <th className="text-right py-2 pl-3">Canceled</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byFactory.map((f) => (
                <tr key={f.factoryId} className="border-t border-slate-100">
                  <td className="py-3 pr-4 font-semibold text-slate-900">{f.factoryName}</td>
                  <td className="py-3 px-3 text-right">{f.totals.total}</td>
                  <td className="py-3 px-3 text-right">{f.totals.PENDING_PAYMENT_APPROVAL}</td>
                  <td className="py-3 px-3 text-right">{f.totals.IN_PRODUCTION}</td>
                  <td className="py-3 px-3 text-right">{f.totals.PRE_SHIPPING}</td>
                  <td className="py-3 px-3 text-right">{f.totals.COMPLETED}</td>
                  <td className="py-3 px-3 text-right">{f.totals.SERVICE_WARRANTY || 0}</td>
                  <td className="py-3 pl-3 text-right">{f.totals.CANCELED}</td>
                </tr>
              ))}
              {metrics.byFactory.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-slate-500">No data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function QuickAction({
  label,
  href,
  Icon,
  tone,
}: {
  label: string
  href: string
  Icon: LucideIcon
  tone: 'slate' | 'indigo' | 'sky' | 'emerald'
}) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900 hover:border-slate-300',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300',
    sky: 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300',
  }
  return (
    <Link href={href} className={`group rounded-[1.4rem] border px-4 py-4 transition shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon size={18} />
        </div>
        <ArrowRight size={16} className="opacity-55 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <div className="mt-4 text-[15px] font-black">{label}</div>
    </Link>
  )
}

function StatCard({
  label,
  value,
  Icon,
  tone,
  trend,
  trendKey,
}: {
  label: string
  value: number | string
  Icon: LucideIcon
  tone: 'slate' | 'amber' | 'indigo' | 'violet' | 'emerald' | 'sky'
  trend?: Metrics['statusTrend']
  trendKey?: 'needsDeposit' | 'production' | 'preShipping' | 'finalPaymentNeeded'
}) {
  const tones = {
    slate: 'border-slate-200 bg-white/82 text-slate-900',
    amber: 'border-amber-200 bg-amber-50/88 text-amber-900',
    indigo: 'border-indigo-200 bg-indigo-50/88 text-indigo-900',
    violet: 'border-violet-200 bg-violet-50/88 text-violet-900',
    emerald: 'border-emerald-200 bg-emerald-50/88 text-emerald-900',
    sky: 'border-sky-200 bg-sky-50/88 text-sky-900',
  }
  return (
    <div className={`rounded-[1.6rem] border p-4 shadow-[0_12px_36px_rgba(13,47,69,0.08)] ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold opacity-80">{label}</div>
        <Icon size={18} className="opacity-75" />
      </div>
      <div className="mt-3 text-[2rem] leading-none font-black">{value}</div>
      {trend && trendKey ? (
        <div className="mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <Area
                type="monotone"
                dataKey={trendKey}
                stroke={
                  tone === 'amber'
                    ? '#d97706'
                    : tone === 'indigo'
                    ? '#4f46e5'
                    : tone === 'violet'
                    ? '#7c3aed'
                    : '#0284c7'
                }
                fillOpacity={0.18}
                fill={
                  tone === 'amber'
                    ? '#f59e0b'
                    : tone === 'indigo'
                    ? '#6366f1'
                    : tone === 'violet'
                    ? '#8b5cf6'
                    : '#38bdf8'
                }
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  )
}

function CellBar({ fill }: { fill: string }) {
  return <Cell fill={fill} />
}

function SignalCard({
  label,
  value,
  detail,
  href,
  tone,
}: {
  label: string
  value: number
  detail: string
  href: string
  tone: 'rose' | 'indigo' | 'sky' | 'amber' | 'emerald' | 'violet'
}) {
  const tones = {
    rose: 'border-rose-200 bg-rose-50/88 text-rose-900',
    indigo: 'border-indigo-200 bg-indigo-50/88 text-indigo-900',
    sky: 'border-sky-200 bg-sky-50/88 text-sky-900',
    amber: 'border-amber-200 bg-amber-50/88 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50/88 text-emerald-900',
    violet: 'border-violet-200 bg-violet-50/88 text-violet-900',
  }
  return (
    <Link
      href={href}
      className={`group rounded-[1.45rem] border p-4 shadow-[0_12px_36px_rgba(13,47,69,0.08)] transition hover:shadow-[0_16px_40px_rgba(13,47,69,0.12)] ${tones[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.14em] opacity-80">{label}</div>
          <div className="mt-3 text-[2rem] leading-none font-black">{value}</div>
        </div>
        <ArrowRight size={16} className="mt-1 opacity-55 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed opacity-80">{detail}</p>
    </Link>
  )
}

function ActionGroup({
  title,
  detail,
  cards,
}: {
  title: string
  detail: string
  cards: Array<{
    label: string
    value: number
    detail: string
    href: string
    tone: 'rose' | 'indigo' | 'sky' | 'amber' | 'emerald' | 'violet'
  }>
}) {
  return (
    <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{detail}</div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <SignalCard
            key={`${title}-${card.label}`}
            label={card.label}
            value={card.value}
            detail={card.detail}
            href={card.href}
            tone={card.tone}
          />
        ))}
      </div>
    </div>
  )
}

function PulseRow({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'indigo' | 'violet' | 'emerald' }) {
  const tones = {
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
          <span className={`h-2.5 w-2.5 rounded-full ${tones[tone]}`} />
          {label}
        </div>
        <div className="text-[1.3rem] font-black text-white">{value}</div>
      </div>
    </div>
  )
}

function SnapshotCard({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'indigo' | 'rose' }) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
  }
  const icons = {
    emerald: Factory,
    amber: CircleAlert,
    indigo: CircleCheckBig,
    rose: CircleX,
  }
  const Icon = icons[tone]
  return (
    <div className={`rounded-[1.35rem] border px-4 py-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] opacity-80">{label}</div>
        <Icon size={16} className="opacity-75" />
      </div>
      <div className="mt-3 text-[1.9rem] leading-none font-black">{value}</div>
    </div>
  )
}
