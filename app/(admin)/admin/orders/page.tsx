// glimmerglass-order-system/app/(admin)/admin/orders/page.tsx
'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CircleCheckBig,
  CircleX,
  Clock,
  FileText,
  PackageSearch,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Group,
  Factory as FactoryIcon,
  UserCircle2,
  RefreshCw,
  ArrowUpDown,
  Truck,
  ExternalLink,
} from 'lucide-react'

import MissingRequirementsModal from '@/components/admin/MissingRequirementsModal'
import { STATUS_LABELS, type FlowStatus } from '@/lib/orderFlow'

type Maybe<T> = T | null | undefined

interface Order {
  id: string
  deliveryAddress: string
  status: string
  paymentProofUrl?: string | null
  poolModel: Maybe<{ name: string }>
  color: Maybe<{ name: string }>
  dealer: Maybe<{ name: string }>
  factoryLocation: Maybe<{ name: string }>
  createdAt?: string
}

type ApiResp = {
  items: Order[]
  page: number
  pageSize: number
  total: number
}

type MissingPayload = {
  code?: string
  message?: string
  targetStatus?: string
  missing?: {
    docs?: string[]
    fields?: string[]
  }
}

// UI constants
const aqua = '#00B2CA'
const deep = '#007A99'

// ✅ APPROVED fuera del UI
const ALL_STATUS = [
  'PENDING_PAYMENT_APPROVAL',
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
  'CANCELED',
] as const
type StatusKey = (typeof ALL_STATUS)[number]

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function labelStatus(status: string) {
  const key = status as FlowStatus
  return STATUS_LABELS[key] ?? status.replaceAll('_', ' ')
}

function StatusBadge({ status }: { status: string }) {
  const base = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border'
  const dot = 'h-2 w-2 rounded-full'

  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL':
      return (
        <span className={`${base} bg-amber-50 text-amber-900 border-amber-200`}>
          <span className={`${dot} bg-amber-500`} />
          Pending
        </span>
      )
    case 'IN_PRODUCTION':
      return (
        <span className={`${base} bg-indigo-50 text-indigo-900 border-indigo-200`}>
          <span className={`${dot} bg-indigo-500`} />
          In Production
        </span>
      )
    case 'PRE_SHIPPING':
      return (
        <span className={`${base} bg-violet-50 text-violet-900 border-violet-200`}>
          <span className={`${dot} bg-violet-500`} />
          Pre-Shipping
        </span>
      )
    case 'COMPLETED':
      return (
        <span className={`${base} bg-emerald-50 text-emerald-900 border-emerald-200`}>
          <span className={`${dot} bg-emerald-500`} />
          Completed
        </span>
      )
    case 'CANCELED':
      return (
        <span className={`${base} bg-rose-50 text-rose-900 border-rose-200`}>
          <span className={`${dot} bg-rose-500`} />
          Canceled
        </span>
      )
    default:
      return (
        <span className={`${base} bg-slate-50 text-slate-800 border-slate-200`}>
          <span className={`${dot} bg-slate-400`} />
          {labelStatus(status)}
        </span>
      )
  }
}

function SkeletonGroup() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="h-6 w-64 rounded bg-slate-100 animate-pulse" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

/**
 * Botón “siguiente paso” según flow:
 * PENDING_PAYMENT_APPROVAL -> IN_PRODUCTION -> PRE_SHIPPING -> COMPLETED
 */
function NextStep({
  order,
  busy,
  onAdvance,
  onCancel,
}: {
  order: Order
  busy: boolean
  onAdvance: (next: FlowStatus) => void
  onCancel: () => void
}) {
  const s = order.status as FlowStatus

  // Completed/Canceled: nada que hacer
  if (s === 'COMPLETED' || s === 'CANCELED') {
    return (
      <div className="flex items-center justify-between gap-2 w-full xl:w-auto">
        <div className="text-xs text-slate-500">No actions</div>
      </div>
    )
  }

  const primary =
    s === 'PENDING_PAYMENT_APPROVAL'
      ? {
          label: 'Start',
          icon: <Clock size={16} />,
          next: 'IN_PRODUCTION' as FlowStatus,
          className:
            'bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_10px_30px_rgba(79,70,229,0.25)]',
        }
      : s === 'IN_PRODUCTION'
      ? {
          label: 'Pre-Ship',
          icon: <Truck size={16} />,
          next: 'PRE_SHIPPING' as FlowStatus,
          className:
            'bg-violet-600 hover:bg-violet-700 text-white shadow-[0_10px_30px_rgba(124,58,237,0.25)]',
        }
      : {
          label: 'Complete',
          icon: <CircleCheckBig size={16} />,
          next: 'COMPLETED' as FlowStatus,
          className:
            'bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_10px_30px_rgba(16,185,129,0.25)]',
        }

  return (
    <div className="flex items-center gap-2 w-full xl:w-auto">
      <button
        disabled={busy}
        onClick={() => onAdvance(primary.next)}
        className={[
          'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-2xl text-sm font-bold transition',
          'focus:outline-none focus:ring-2 focus:ring-slate-300/70',
          busy ? 'opacity-60 cursor-not-allowed' : '',
          primary.className,
        ].join(' ')}
        title={`Move to ${labelStatus(primary.next)}`}
      >
        {primary.icon}
        {primary.label}
      </button>

      <button
        disabled={busy}
        onClick={onCancel}
        className={[
          'h-10 w-10 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700',
          'hover:bg-rose-100 transition inline-flex items-center justify-center',
          'focus:outline-none focus:ring-2 focus:ring-rose-200',
          busy ? 'opacity-60 cursor-not-allowed' : '',
        ].join(' ')}
        title="Cancel order"
      >
        <CircleX size={18} />
      </button>
    </div>
  )
}

function AdminOrdersInner() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Missing requirements modal
  const [missingOpen, setMissingOpen] = useState(false)
  const [missingDocs, setMissingDocs] = useState<string[]>([])
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [missingTarget, setMissingTarget] = useState<string | null>(null)
  const [missingUploadHref, setMissingUploadHref] = useState<string | null>(null)

  const q = sp.get('q') || ''
  const statusFilter = (sp.get('status') as StatusKey | 'ALL') || 'ALL'
  const dealerFilter = sp.get('dealer') || 'ALL'
  const factoryFilter = sp.get('factory') || 'ALL'
  const sort = sp.get('sort') || 'createdAt'
  const dir = sp.get('dir') || 'desc'
  const page = Math.max(1, Number(sp.get('page') || 1))
  const pageSize = Math.max(5, Number(sp.get('pageSize') || 20))

  const setParams = (patch: Record<string, string | number | undefined | null>) => {
    const params = new URLSearchParams(sp.toString())
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') params.delete(k)
      else params.set(k, String(v))
    })
    router.replace(`${pathname}?${params.toString()}`)
  }

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (dealerFilter !== 'ALL') params.set('dealer', dealerFilter)
      if (factoryFilter !== 'ALL') params.set('factory', factoryFilter)
      params.set('sort', sort)
      params.set('dir', dir)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/orders?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load orders')

      const data = await safeJson<ApiResp>(res)
      setOrders(data?.items ?? [])
    } catch (e) {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter, dealerFilter, factoryFilter, sort, dir, page, pageSize])

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const openMissing = (orderId: string, nextStatus: string, payload: MissingPayload | null) => {
    setMissingTarget(payload?.targetStatus ?? nextStatus)
    setMissingDocs(payload?.missing?.docs ?? [])
    setMissingFields(payload?.missing?.fields ?? [])
    setMissingUploadHref(`/admin/orders/${orderId}/media`)
    setMissingOpen(true)
  }

  const updateStatus = async (orderId: string, newStatus: FlowStatus) => {
    try {
      setBusyId(orderId)

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, comment: 'Status changed from Orders list' }),
      })

      const payload = await safeJson<any>(res)

      if (!res.ok) {
        if (payload?.code === 'MISSING_REQUIREMENTS') {
          openMissing(orderId, newStatus, payload as MissingPayload)
          return
        }
        throw new Error(payload?.message || 'Failed to update status')
      }

      const updated = payload as Order
      if (!updated?.id) throw new Error('Invalid response')

      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
      router.refresh()
    } catch (e: any) {
      alert(e?.message || 'Could not update status')
    } finally {
      setBusyId(null)
    }
  }

  // Filters lists from current page items (tu patrón original)
  const dealers = useMemo(() => {
    const s = new Set<string>()
    orders.forEach((o) => s.add(o.dealer?.name || 'Unknown Dealer'))
    return Array.from(s).sort()
  }, [orders])

  const factories = useMemo(() => {
    const s = new Set<string>()
    orders.forEach((o) => s.add(o.factoryLocation?.name || 'Unknown Factory'))
    return Array.from(s).sort()
  }, [orders])

  const [groupBy, setGroupBy] = useState<'DEALER' | 'FACTORY'>('DEALER')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  function groupKeys(list: Order[], g: 'DEALER' | 'FACTORY') {
    const s = new Set<string>()
    const keyer =
      g === 'DEALER'
        ? (o: Order) => o.dealer?.name || 'Unknown Dealer'
        : (o: Order) => o.factoryLocation?.name || 'Unknown Factory'
    list.forEach((o) => s.add(keyer(o)))
    return Array.from(s).sort()
  }

  useEffect(() => {
    const keys = groupKeys(orders, groupBy)
    const map = keys.reduce((acc, k) => {
      acc[k] = true
      return acc
    }, {} as Record<string, boolean>)
    setOpenGroups(map)
  }, [orders, groupBy])

  const grouped = useMemo(() => {
    const keyer =
      groupBy === 'DEALER'
        ? (o: Order) => o.dealer?.name || 'Unknown Dealer'
        : (o: Order) => o.factoryLocation?.name || 'Unknown Factory'

    return orders.reduce((acc, o) => {
      const k = keyer(o)
      ;(acc[k] ||= []).push(o)
      return acc
    }, {} as Record<string, Order[]>)
  }, [orders, groupBy])

  // Total count (tu patrón)
  const [totalCount, setTotalCount] = useState(0)
  useEffect(() => {
    ;(async () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (dealerFilter !== 'ALL') params.set('dealer', dealerFilter)
      if (factoryFilter !== 'ALL') params.set('factory', factoryFilter)
      params.set('sort', sort)
      params.set('dir', dir)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/orders?${params.toString()}`, { cache: 'no-store' })
      const data = (await safeJson<ApiResp>(res)) || { total: 0, items: [], page: 1, pageSize: 20 }
      setTotalCount(data.total || 0)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter, dealerFilter, factoryFilter, sort, dir, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const toggleSort = (col: 'createdAt' | 'status') => {
    const nextDir = sort === col ? (dir === 'asc' ? 'desc' : 'asc') : 'desc'
    setParams({ sort: col, dir: nextDir, page: 1 })
  }

  const exportUrl = () => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (dealerFilter !== 'ALL') params.set('dealer', dealerFilter)
    if (factoryFilter !== 'ALL') params.set('factory', factoryFilter)
    params.set('sort', sort)
    params.set('dir', dir)
    return `/api/admin/orders/export?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <MissingRequirementsModal
        open={missingOpen}
        onClose={() => setMissingOpen(false)}
        targetStatus={missingTarget}
        missingDocs={missingDocs}
        missingFields={missingFields}
        goToUploadHref={missingUploadHref}
      />

      {/* Header */}
      <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">Order Management</h1>
            <p className="text-slate-600 mt-1">Review, filter and update orders</p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={exportUrl()}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-bold"
            >
              <FileText size={16} />
              Export CSV
            </a>

            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-bold"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} />
              Refresh
            </button>

            <div
              className="hidden sm:block h-1 w-28 rounded-full"
              style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative w-full lg:w-[420px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setParams({ q: e.target.value, page: 1 })}
              placeholder="Search (model, color, dealer, factory, address)"
              className="w-full pl-11 pr-4 h-11 rounded-2xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2">
              <Filter size={16} className="text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setParams({ status: e.target.value, page: 1 })}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold"
              >
                <option value="ALL">All statuses</option>
                {ALL_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {labelStatus(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex items-center gap-2">
              <UserCircle2 size={16} className="text-slate-500" />
              <select
                value={dealerFilter}
                onChange={(e) => setParams({ dealer: e.target.value, page: 1 })}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold"
              >
                <option value="ALL">All dealers</option>
                {dealers.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex items-center gap-2">
              <FactoryIcon size={16} className="text-slate-500" />
              <select
                value={factoryFilter}
                onChange={(e) => setParams({ factory: e.target.value, page: 1 })}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold"
              >
                <option value="ALL">All factories</option>
                {factories.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex items-center gap-2">
              <Group size={16} className="text-slate-500" />
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold"
              >
                <option value="DEALER">Group by dealer</option>
                <option value="FACTORY">Group by factory</option>
              </select>
            </div>

            <button
              onClick={() => toggleSort('status')}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-bold"
              title="Sort by status"
            >
              <ArrowUpDown size={16} />
              Sort
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4">
          <SkeletonGroup />
          <SkeletonGroup />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <PackageSearch size={28} className="text-slate-500" />
          </div>
          <h3 className="text-xl font-black text-slate-900">No orders match your filters</h3>
          <p className="text-slate-600 mt-1">Try changing status, dealer/factory or search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([groupName, list]) => {
            const open = openGroups[groupName] ?? true
            const toggle = () => setOpenGroups((prev) => ({ ...prev, [groupName]: !open }))

            return (
              <section
                key={groupName}
                className="rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] overflow-hidden"
              >
                {/* Group header */}
                <header className="flex items-center justify-between px-5 py-4 bg-slate-50/70 border-b border-slate-200/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={toggle}
                      className="h-9 w-9 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 inline-flex items-center justify-center"
                      aria-label="Toggle group"
                    >
                      {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <div className="min-w-0">
                      <div className="text-sm text-slate-500 font-semibold">
                        {groupBy === 'DEALER' ? 'Dealer' : 'Factory'}
                      </div>
                      <div className="text-lg font-black text-slate-900 truncate">
                        {groupName}
                      </div>
                    </div>

                    <span className="text-xs px-3 py-1 rounded-full bg-slate-200/70 text-slate-700 font-bold">
                      {list.length} orders
                    </span>
                  </div>
                </header>

                {!open ? null : (
                  <div className="divide-y divide-slate-100">
                    {/* “Headers” premium (no table) */}
                    <div className="hidden xl:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-black tracking-widest text-slate-500 uppercase bg-white">
                      <div className="col-span-8 grid grid-cols-3 gap-4">
                        <div>Model</div>
                        <div>Dealer</div>
                        <div>Address & Payment</div>
                      </div>
                      <div className="col-span-4 text-right">Status • Next step • Links</div>
                    </div>

                    {list.map((order) => (
                      <div key={order.id} className="px-5 py-4 hover:bg-slate-50/60 transition">
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start min-w-0">
                          {/* LEFT: info */}
                          <div className="xl:col-span-8 min-w-0">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                              {/* Model */}
                              <div className="min-w-0">
                                <Link
                                  href={`/admin/orders/${order.id}/history`}
                                  prefetch={false}
                                  className="text-sky-700 hover:underline font-black text-base block truncate"
                                  title="Open order details"
                                >
                                  {order.poolModel?.name || '-'}
                                </Link>

                                <div className="mt-1 text-sm text-slate-600 min-w-0">
                                  <span className="font-semibold">Factory:</span>{' '}
                                  <span className="truncate inline-block max-w-full align-bottom">
                                    {order.factoryLocation?.name || 'Not set'}
                                  </span>
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                  <span className="font-semibold text-slate-600">Color:</span>{' '}
                                  {order.color?.name || '—'}
                                </div>
                              </div>

                              {/* Dealer */}
                              <div className="min-w-0">
                                <div className="text-slate-900 font-black text-base truncate">
                                  {order.dealer?.name || 'Unknown Dealer'}
                                </div>
                                <div className="mt-1 text-sm text-slate-600">
                                  <span className="font-semibold">Created:</span>{' '}
                                  {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                                </div>
                              </div>

                              {/* Address + Payment */}
                              <div className="min-w-0">
                                <div className="text-slate-700 leading-snug break-words overflow-hidden">
                                  <span className="block">{order.deliveryAddress}</span>
                                </div>

                                <div className="mt-2 text-sm text-slate-600 flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold">Payment:</span>
                                  {order.paymentProofUrl ? (
                                    <a
                                      href={order.paymentProofUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-sky-700 hover:underline font-bold"
                                      title="View payment proof"
                                    >
                                      <ExternalLink size={14} />
                                      View
                                    </a>
                                  ) : (
                                    <span className="text-slate-500">Not uploaded</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* RIGHT: ops */}
                          <div className="xl:col-span-4 min-w-0">
                            <div className="flex flex-col gap-3 xl:items-end">
                              <div className="w-full xl:w-auto flex xl:justify-end">
                                <StatusBadge status={order.status} />
                              </div>

                              <div className="w-full xl:w-auto">
                                <NextStep
                                  order={order}
                                  busy={busyId === order.id}
                                  onAdvance={(next) => updateStatus(order.id, next)}
                                  onCancel={() => updateStatus(order.id, 'CANCELED')}
                                />
                              </div>

                              <div className="grid grid-cols-2 xl:flex xl:flex-col gap-2 w-full xl:w-[180px]">
                                <Link
                                  href={`/admin/orders/${order.id}/history`}
                                  prefetch={false}
                                  className="inline-flex items-center justify-center gap-2 h-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-black"
                                  title="Open order"
                                >
                                  <PackageSearch size={16} />
                                  Open
                                </Link>

                                <Link
                                  href={`/admin/orders/${order.id}/media`}
                                  prefetch={false}
                                  className="inline-flex items-center justify-center gap-2 h-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-black"
                                  title="Files"
                                >
                                  <FileText size={16} />
                                  Files
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-700">
            Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong> • {totalCount} results
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setParams({ page: page - 1 })}
              className="h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 font-bold"
            >
              Prev
            </button>

            <button
              disabled={page >= totalPages}
              onClick={() => setParams({ page: page + 1 })}
              className="h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 font-bold"
            >
              Next
            </button>

            <select
              value={pageSize}
              onChange={(e) => setParams({ pageSize: Number(e.target.value), page: 1 })}
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-600">Loading orders…</div>}>
      <AdminOrdersInner />
    </Suspense>
  )
}