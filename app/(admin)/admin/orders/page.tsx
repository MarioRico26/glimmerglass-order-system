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
  MoreVertical,
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

const aqua = '#00B2CA'
const deep = '#007A99'

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

function formatDateMaybe(iso?: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

function StatusBadge({ status }: { status: string }) {
  const base =
    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap'
  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL':
      return <span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}>Pending</span>
    case 'IN_PRODUCTION':
      return (
        <span className={`${base} bg-indigo-50 text-indigo-800 border-indigo-200`}>
          In Production
        </span>
      )
    case 'PRE_SHIPPING':
      return (
        <span className={`${base} bg-violet-50 text-violet-800 border-violet-200`}>
          Pre-Shipping
        </span>
      )
    case 'COMPLETED':
      return (
        <span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}>
          Completed
        </span>
      )
    case 'CANCELED':
      return <span className={`${base} bg-rose-50 text-rose-800 border-rose-200`}>Canceled</span>
    default:
      return (
        <span className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>
          {labelStatus(status)}
        </span>
      )
  }
}

// ---- Button system (consistent + premium) ----
const btnBase =
  'inline-flex items-center justify-center gap-2 h-9 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200'
const btnSoft = `${btnBase} border border-slate-200 bg-white hover:bg-slate-50 text-slate-800`
const btnPrimary = `${btnBase} bg-sky-700 hover:bg-sky-800 text-white shadow-sm`
const btnIndigo = `${btnBase} bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm`
const btnViolet = `${btnBase} bg-violet-600 hover:bg-violet-700 text-white shadow-sm`
const btnSuccess = `${btnBase} bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm`
const btnDanger = `${btnBase} bg-rose-600 hover:bg-rose-700 text-white shadow-sm`

function SkeletonRow() {
  return (
    <tr className="border-t border-slate-100">
      {Array.from({ length: 11 }).map((_, i) => (
        <td key={i} className="py-3 px-3">
          <div className="h-3 w-full max-w-[180px] animate-pulse rounded bg-slate-200/70" />
        </td>
      ))}
    </tr>
  )
}

type Row =
  | { kind: 'group'; key: string; label: string; count: number; open: boolean }
  | { kind: 'order'; key: string; order: Order; groupKey: string; indexInGroup: number }

function AdminOrdersInner() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Missing requirements modal state
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
    try {
      setLoading(true)
      setError(null)

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
      if (!res.ok) throw new Error((await safeJson<{ message?: string }>(res))?.message || 'Failed')

      const data = await safeJson<ApiResp>(res)
      setOrders(data?.items ?? [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load orders')
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

  useEffect(() => {
    const keys = Object.keys(grouped).sort()
    const map = keys.reduce((acc, k) => {
      acc[k] = openGroups[k] ?? true
      return acc
    }, {} as Record<string, boolean>)
    setOpenGroups(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, orders])

  // total count
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

  function renderNextStep(order: Order) {
    const s = order.status as FlowStatus
    const disabled = busyId === order.id

    if (s === 'PENDING_PAYMENT_APPROVAL') {
      return (
        <button
          disabled={disabled}
          onClick={() => updateStatus(order.id, 'IN_PRODUCTION')}
          className={btnIndigo + ' w-full'}
          title="Move to In Production"
        >
          <Clock size={16} /> Start Prod.
        </button>
      )
    }

    if (s === 'IN_PRODUCTION') {
      return (
        <button
          disabled={disabled}
          onClick={() => updateStatus(order.id, 'PRE_SHIPPING')}
          className={btnViolet + ' w-full'}
          title="Move to Pre-Shipping"
        >
          <Truck size={16} /> Pre-Ship
        </button>
      )
    }

    if (s === 'PRE_SHIPPING') {
      return (
        <button
          disabled={disabled}
          onClick={() => updateStatus(order.id, 'COMPLETED')}
          className={btnSuccess + ' w-full'}
          title="Complete order"
        >
          <CircleCheckBig size={16} /> Complete
        </button>
      )
    }

    return <span className="text-xs text-slate-500">No next step</span>
  }

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    const keys = Object.keys(grouped).sort((a, b) => a.localeCompare(b))

    for (const k of keys) {
      const list = grouped[k] || []
      const open = openGroups[k] ?? true
      out.push({
        kind: 'group',
        key: `group:${k}`,
        label: k,
        count: list.length,
        open,
      })
      if (!open) continue
      list.forEach((o, idx) => {
        out.push({
          kind: 'order',
          key: o.id,
          order: o,
          groupKey: k,
          indexInGroup: idx,
        })
      })
    }
    return out
  }, [grouped, openGroups])

  const hasAny = Object.keys(grouped).length > 0

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
      <div className="rounded-2xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Order Management</h1>
            <p className="text-slate-600">Premium view: sticky header, grouped rows, next-step flow</p>
            {error && (
              <div className="mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 inline-block">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a href={exportUrl()} className={btnSoft}>
              <FileText size={16} />
              Export CSV
            </a>

            <button onClick={handleRefresh} className={btnSoft} title="Refresh">
              <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} />
              Refresh
            </button>

            <div
              className="h-1 w-32 rounded-full"
              style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setParams({ q: e.target.value, page: 1 })}
              placeholder="Search (model, color, dealer, factory, address)"
              className="pl-8 pr-3 h-10 rounded-xl border border-slate-200 bg-white w-80 max-w-[90vw] focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setParams({ status: e.target.value, page: 1 })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="ALL">All statuses</option>
              {ALL_STATUS.map((s) => (
                <option key={s} value={s}>
                  {labelStatus(s)}
                </option>
              ))}
            </select>

            <UserCircle2 size={16} className="text-slate-500" />
            <select
              value={dealerFilter}
              onChange={(e) => setParams({ dealer: e.target.value, page: 1 })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="ALL">All dealers</option>
              {dealers.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <FactoryIcon size={16} className="text-slate-500" />
            <select
              value={factoryFilter}
              onChange={(e) => setParams({ factory: e.target.value, page: 1 })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="ALL">All factories</option>
              {factories.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <Group size={16} className="text-slate-500" />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="DEALER">Group by dealer</option>
              <option value="FACTORY">Group by factory</option>
            </select>
          </div>
        </div>
      </div>

      {/* Premium Table Shell */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto p-2">
            <table className="min-w-full text-sm">
              <thead className="text-slate-600 bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-3">Model</th>
                  <th className="text-left py-3 px-3">Color</th>
                  <th className="text-left py-3 px-3">Dealer</th>
                  <th className="text-left py-3 px-3">Factory</th>
                  <th className="text-left py-3 px-3">Address</th>
                  <th className="text-left py-3 px-3">Status</th>
                  <th className="text-left py-3 px-3">Payment</th>
                  <th className="text-left py-3 px-3">Created</th>
                  <th className="text-left py-3 px-3">Next step</th>
                  <th className="text-left py-3 px-3">Actions</th>
                  <th className="text-left py-3 px-3">Links</th>
                </tr>
              </thead>
              <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
            </table>
          </div>
        ) : !hasAny ? (
          <div className="p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <PackageSearch size={28} className="text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No orders match your filters</h3>
            <p className="text-slate-600">Try changing status, dealer/factory or search.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[72vh]">
            <table className="min-w-[1200px] w-full text-sm">
              {/* Sticky header */}
              <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 text-slate-600">
                <tr>
                  <th className="text-left py-3 px-3 w-[220px]">
                    Model
                  </th>
                  <th className="text-left py-3 px-3 w-[160px]">Color</th>
                  <th className="text-left py-3 px-3 w-[220px]">Dealer</th>
                  <th className="text-left py-3 px-3 w-[180px]">Factory</th>
                  <th className="text-left py-3 px-3 w-[320px]">Address</th>
                  <th className="text-left py-3 px-3 w-[150px]">
                    <button
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                      onClick={() => toggleSort('status')}
                      title="Sort by status"
                    >
                      Status <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="text-left py-3 px-3 w-[140px]">Payment</th>
                  <th className="text-left py-3 px-3 w-[190px]">
                    <button
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                      onClick={() => toggleSort('createdAt')}
                      title="Sort by created date"
                    >
                      Created <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="text-left py-3 px-3 w-[180px]">Next step</th>
                  <th className="text-left py-3 px-3 w-[120px]">Actions</th>
                  <th className="text-left py-3 px-3 w-[160px]">Links</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  if (r.kind === 'group') {
                    const groupName = r.label
                    const open = r.open
                    const toggle = () =>
                      setOpenGroups((prev) => ({ ...prev, [groupName]: !open }))

                    return (
                      <tr key={r.key} className="bg-slate-50/60">
                        <td colSpan={11} className="py-3 px-3">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={toggle}
                              className="inline-flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-white border border-transparent hover:border-slate-200 transition text-slate-900 font-semibold"
                              aria-label="Toggle group"
                            >
                              {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              <span className="text-slate-700">
                                {groupBy === 'DEALER' ? 'Dealer' : 'Factory'}:
                              </span>
                              <span className="text-slate-900">{groupName}</span>
                              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                                {r.count} orders
                              </span>
                            </button>

                            <div className="text-xs text-slate-500">
                              Scroll stays smooth. Header stays sticky. Humans stay happy.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  const o = r.order
                  const zebra = r.indexInGroup % 2 === 0
                  const disabled = busyId === o.id

                  return (
                    <tr
                      key={r.key}
                      className={[
                        zebra ? 'bg-white' : 'bg-slate-50/30',
                        'hover:bg-sky-50/40 transition',
                      ].join(' ')}
                    >
                      <td className="py-3 px-3">
                        <Link
                          href={`/admin/orders/${o.id}/history`}
                          prefetch={false}
                          className="text-sky-800 hover:underline font-semibold"
                          title="Open order timeline (History)"
                        >
                          {o.poolModel?.name || '-'}
                        </Link>
                      </td>

                      <td className="py-3 px-3">{o.color?.name || '-'}</td>
                      <td className="py-3 px-3">{o.dealer?.name || 'Unknown Dealer'}</td>
                      <td className="py-3 px-3">{o.factoryLocation?.name || 'Unknown Factory'}</td>

                      <td className="py-3 px-3">
                        <div className="max-w-[320px] truncate" title={o.deliveryAddress}>
                          {o.deliveryAddress}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <StatusBadge status={o.status} />
                      </td>

                      <td className="py-3 px-3">
                        {o.paymentProofUrl ? (
                          <a
                            href={o.paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sky-800 font-semibold hover:underline"
                            title="View payment proof"
                          >
                            <FileText size={16} />
                            View
                            <ExternalLink size={14} className="text-slate-400" />
                          </a>
                        ) : (
                          <span className="text-slate-500">Not uploaded</span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">{formatDateMaybe(o.createdAt)}</td>

                      <td className="py-3 px-3">
                        <div className="w-[170px]">{renderNextStep(o)}</div>
                      </td>

                      {/* Actions: clean dropdown menu */}
                      <td className="py-3 px-3">
                        <details className="relative">
                          <summary
                            className={[
                              btnSoft,
                              'h-9 px-2 w-10 justify-center',
                              'list-none cursor-pointer select-none',
                            ].join(' ')}
                            title="Actions"
                          >
                            <MoreVertical size={18} />
                          </summary>

                          <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-xl z-30 overflow-hidden">
                            <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
                              Order actions
                            </div>

                            <Link
                              href={`/admin/orders/${o.id}/history`}
                              prefetch={false}
                              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              <PackageSearch size={16} /> Open details
                            </Link>

                            <Link
                              href={`/admin/orders/${o.id}/media`}
                              prefetch={false}
                              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              <FileText size={16} /> Files / Upload
                            </Link>

                            {o.status !== 'COMPLETED' && o.status !== 'CANCELED' && (
                              <button
                                disabled={disabled}
                                onClick={(e) => {
                                  e.preventDefault()
                                  updateStatus(o.id, 'CANCELED')
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                              >
                                <CircleX size={16} /> Cancel order
                              </button>
                            )}
                          </div>
                        </details>
                      </td>

                      {/* Links */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <Link
                            href={`/admin/orders/${o.id}/history`}
                            prefetch={false}
                            className="inline-flex items-center gap-1 text-sky-800 font-semibold hover:underline"
                            title="Order timeline"
                          >
                            <Clock size={16} /> History
                          </Link>

                          <Link
                            href={`/admin/orders/${o.id}/media`}
                            prefetch={false}
                            className="inline-flex items-center gap-1 text-sky-800 font-semibold hover:underline"
                            title="View & upload files"
                          >
                            <FileText size={16} /> Files
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-slate-600">
          Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong> •{' '}
          <strong>{totalCount}</strong> results
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            disabled={page <= 1}
            onClick={() => setParams({ page: page - 1 })}
            className={btnSoft}
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setParams({ page: page + 1 })}
            className={btnSoft}
          >
            Next
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Page size</span>
            <select
              value={pageSize}
              onChange={(e) => setParams({ pageSize: Number(e.target.value), page: 1 })}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
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
        details > summary::-webkit-details-marker {
          display: none;
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