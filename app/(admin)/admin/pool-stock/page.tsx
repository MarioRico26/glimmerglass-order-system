'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'

type Factory = { id: string; name: string }

type PoolModel = {
  id: string
  name: string
  lengthFt: number | null
  widthFt: number | null
  depthFt: number | null
}

type Color = { id: string; name: string; swatchUrl?: string | null }

type PoolStockItem = {
  id: string
  status: 'READY' | 'RESERVED' | 'IN_PRODUCTION' | 'DAMAGED'
  quantity: number
  eta: string | null
  notes: string | null
  updatedAt: string
  factory: Factory
  poolModel: PoolModel
  color: Color | null
}

type Txn = {
  id: string
  type: 'ADD' | 'RESERVE' | 'RELEASE' | 'SHIP' | 'ADJUST'
  quantity: number
  notes?: string | null
  referenceOrderId?: string | null
  createdAt: string
  order?: { id: string; status: string } | null
}

const STATUS_OPTIONS: PoolStockItem['status'][] = [
  'READY',
  'RESERVED',
  'IN_PRODUCTION',
  'DAMAGED',
]

function toDateInputValue(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function statusBadge(status: PoolStockItem['status']) {
  switch (status) {
    case 'READY':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'RESERVED':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'IN_PRODUCTION':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'DAMAGED':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

export default function AdminPoolStockPage() {
  const [items, setItems] = useState<PoolStockItem[]>([])
  const [factories, setFactories] = useState<Factory[]>([])
  const [models, setModels] = useState<PoolModel[]>([])
  const [colors, setColors] = useState<Color[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [filterFactoryId, setFilterFactoryId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [includeZero, setIncludeZero] = useState(false)
  const [search, setSearch] = useState('')

  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    factoryId: '',
    poolModelId: '',
    colorId: '',
    status: 'READY' as PoolStockItem['status'],
    quantity: 0,
    eta: '',
    notes: '',
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    status: 'READY' as PoolStockItem['status'],
    quantity: 0,
    eta: '',
    notes: '',
  })

  const [txnsById, setTxnsById] = useState<Record<string, Txn[]>>({})
  const [txnOpenId, setTxnOpenId] = useState<string | null>(null)
  const [txnLoadingId, setTxnLoadingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filterFactoryId) params.set('factoryId', filterFactoryId)
      if (filterStatus) params.set('status', filterStatus)
      if (includeZero) params.set('includeZero', 'true')

      const [stockRes, factoryRes, modelRes, colorRes] = await Promise.all([
        fetch(`/api/admin/pool-stock?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/catalog/factories', { cache: 'no-store' }),
        fetch('/api/catalog/pool-models', { cache: 'no-store' }),
        fetch('/api/catalog/colors', { cache: 'no-store' }),
      ])

      const stockJson = await stockRes.json().catch(() => null)
      const factoryJson = await factoryRes.json().catch(() => null)
      const modelJson = await modelRes.json().catch(() => null)
      const colorJson = await colorRes.json().catch(() => null)

      if (!stockRes.ok) throw new Error(stockJson?.message || 'Failed to load pool stock')

      setItems(Array.isArray(stockJson?.items) ? stockJson.items : [])
      setFactories(Array.isArray(factoryJson?.items) ? factoryJson.items : Array.isArray(factoryJson) ? factoryJson : [])
      setModels(Array.isArray(modelJson?.items) ? modelJson.items : [])
      setColors(Array.isArray(colorJson?.items) ? colorJson.items : [])

      if (!createForm.factoryId && factoryJson?.items?.length) {
        setCreateForm((prev) => ({ ...prev, factoryId: factoryJson.items[0].id }))
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load data')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFactoryId, filterStatus, includeZero])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      return (
        it.poolModel?.name?.toLowerCase().includes(q) ||
        it.factory?.name?.toLowerCase().includes(q) ||
        (it.color?.name || '').toLowerCase().includes(q) ||
        it.status.toLowerCase().includes(q)
      )
    })
  }, [items, search])

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const payload = {
        factoryId: createForm.factoryId,
        poolModelId: createForm.poolModelId,
        colorId: createForm.colorId || null,
        status: createForm.status,
        quantity: Number(createForm.quantity || 0),
        eta: createForm.eta || null,
        notes: createForm.notes || null,
      }

      const res = await fetch('/api/admin/pool-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to create stock row')

      setCreateForm((prev) => ({
        ...prev,
        poolModelId: '',
        colorId: '',
        quantity: 0,
        eta: '',
        notes: '',
      }))

      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to create stock row')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (item: PoolStockItem) => {
    setEditingId(item.id)
    setEditForm({
      status: item.status,
      quantity: item.quantity,
      eta: toDateInputValue(item.eta),
      notes: item.notes || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: string) => {
    setError('')
    try {
      const payload = {
        status: editForm.status,
        quantity: Number(editForm.quantity),
        eta: editForm.eta || null,
        notes: editForm.notes || null,
      }

      const res = await fetch(`/api/admin/pool-stock/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to update stock row')

      const updated = json?.item as PoolStockItem | undefined
      if (updated) {
        setItems((prev) => {
          if (!includeZero && updated.quantity === 0) {
            return prev.filter((it) => it.id !== id)
          }
          return prev.map((it) => (it.id === id ? updated : it))
        })
      }

      setEditingId(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to update stock row')
    }
  }

  const toggleTxns = async (id: string) => {
    if (txnOpenId === id) {
      setTxnOpenId(null)
      return
    }
    setTxnOpenId(id)

    if (txnsById[id]) return

    setTxnLoadingId(id)
    try {
      const res = await fetch(`/api/admin/pool-stock/${id}/txns?limit=20`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to load transactions')
      setTxnsById((prev) => ({ ...prev, [id]: json?.items || [] }))
    } catch (e: any) {
      setError(e?.message || 'Failed to load transactions')
    } finally {
      setTxnLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Pool Stock</h1>
        <p className="text-slate-600">Finished pools by factory. Adjust quantity, status and ETA.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <form onSubmit={submitCreate} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900 mb-3">Add Stock Row</div>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-6">
          <select
            value={createForm.factoryId}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, factoryId: e.target.value }))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            required
          >
            <option value="">Factory</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <select
            value={createForm.poolModelId}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, poolModelId: e.target.value }))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            required
          >
            <option value="">Pool model</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <select
            value={createForm.colorId}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, colorId: e.target.value }))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">No color</option>
            {colors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={createForm.status}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value as PoolStockItem['status'] }))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
            ))}
          </select>

          <input
            type="number"
            min={0}
            value={createForm.quantity}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-right"
            placeholder="Qty"
          />

          <input
            type="date"
            value={createForm.eta}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, eta: e.target.value }))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          />

          <input
            value={createForm.notes}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm xl:col-span-2"
            placeholder="Notes"
          />

          <button
            type="submit"
            disabled={creating}
            className="h-10 w-full rounded-lg bg-black text-white px-4 text-sm font-semibold disabled:opacity-60 xl:col-span-1"
          >
            {creating ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_auto] mb-3">
          <select
            value={filterFactoryId}
            onChange={(e) => setFilterFactoryId(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All factories</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
            ))}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            placeholder="Search model / factory / color / status"
          />

          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeZero}
              onChange={(e) => setIncludeZero(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show zero
          </label>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500">No stock rows found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Factory</th>
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Color</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3">ETA</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const editing = editingId === it.id
                  const txnsOpen = txnOpenId === it.id
                  const txns = txnsById[it.id] || []

                  return (
                    <Fragment key={it.id}>
                      <tr className="border-t">
                        <td className="py-3 pr-3 font-semibold text-slate-900">{it.factory?.name}</td>
                        <td className="py-3 pr-3">{it.poolModel?.name}</td>
                        <td className="py-3 pr-3">{it.color?.name || '—'}</td>
                        <td className="py-3 pr-3">
                          {editing ? (
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as PoolStockItem['status'] }))}
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${statusBadge(it.status)}`}>
                              {it.status.replaceAll('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              value={editForm.quantity}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                              className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right"
                            />
                          ) : (
                            it.quantity
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          {editing ? (
                            <input
                              type="date"
                              value={editForm.eta}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, eta: e.target.value }))}
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2"
                            />
                          ) : (
                            toDateInputValue(it.eta) || '—'
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          {editing ? (
                            <input
                              value={editForm.notes}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                              className="h-9 w-56 rounded-lg border border-slate-200 bg-white px-2"
                            />
                          ) : (
                            <span className="text-slate-600">{it.notes || '—'}</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-500">
                          {it.updatedAt ? new Date(it.updatedAt).toLocaleString() : '—'}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          {editing ? (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => saveEdit(it.id)}
                                className="h-8 rounded-lg bg-slate-900 text-white px-3 text-xs font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => startEdit(it)}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => toggleTxns(it.id)}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs"
                              >
                                {txnsOpen ? 'Hide' : 'History'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {txnsOpen && (
                        <tr className="border-t bg-slate-50/50">
                          <td colSpan={9} className="py-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-semibold text-slate-700 mb-2">Last movements</div>
                              {txnLoadingId === it.id ? (
                                <div className="text-sm text-slate-500">Loading…</div>
                              ) : txns.length === 0 ? (
                                <div className="text-sm text-slate-500">No transactions.</div>
                              ) : (
                                <div className="space-y-2 text-xs text-slate-700">
                                  {txns.map((t) => {
                                    const signedQty =
                                      t.type === 'RESERVE' || t.type === 'SHIP'
                                        ? -Math.abs(t.quantity)
                                        : t.quantity

                                    return (
                                      <div key={t.id} className="flex items-center justify-between border-b border-slate-200 pb-1">
                                        <div className="font-semibold">
                                          {t.type} {signedQty > 0 ? `+${signedQty}` : signedQty}
                                          {t.order?.id ? ` • Order ${t.order.id.slice(0, 8)}` : ''}
                                        </div>
                                        <div className="text-slate-500">
                                          {new Date(t.createdAt).toLocaleString()}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
