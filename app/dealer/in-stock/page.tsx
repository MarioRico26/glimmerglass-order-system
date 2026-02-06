'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Factory, Palette, Timer } from 'lucide-react'

type StockRow = {
  id: string
  status: 'READY'
  quantity: number
  eta: string | null
  factory: { id: string; name: string; city?: string | null; state?: string | null }
  poolModel: { id: string; name: string; lengthFt?: number | null; widthFt?: number | null; depthFt?: number | null }
  color: { id: string; name: string; swatchUrl?: string | null } | null
}

function toDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

export default function DealerInStockPage() {
  const [items, setItems] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/dealer/in-stock', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.message || 'Failed to load stock')
        setItems(Array.isArray(json?.items) ? json.items : [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load stock')
        setItems([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      return (
        it.poolModel?.name?.toLowerCase().includes(q) ||
        it.factory?.name?.toLowerCase().includes(q) ||
        (it.color?.name || '').toLowerCase().includes(q)
      )
    })
  }, [items, search])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">In Stock</h1>
        <p className="text-slate-600">Ready pools available now by factory.</p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 flex items-center gap-2">
        <CheckCircle2 size={18} />
        <span className="font-semibold">IN STOCK — READY TO SHIP</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            Showing only pools with status <span className="font-semibold">READY</span>.
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full md:w-72 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            placeholder="Search model / factory / color"
          />
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">Loading…</div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500">No ready stock available.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Factory</th>
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Color</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3">ETA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <Factory size={16} className="text-slate-400" />
                        {it.factory?.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {it.factory?.city || ''}{it.factory?.state ? `, ${it.factory.state}` : ''}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-900">{it.poolModel?.name}</div>
                      <div className="text-xs text-slate-500">
                        {it.poolModel?.lengthFt ? `${it.poolModel.lengthFt}ft` : ''}
                        {it.poolModel?.widthFt ? ` × ${it.poolModel.widthFt}ft` : ''}
                        {it.poolModel?.depthFt ? ` × ${it.poolModel.depthFt}ft` : ''}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <Palette size={14} className="text-slate-400" />
                        <span className="text-slate-700">{it.color?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right font-semibold text-slate-900">
                      {it.quantity}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Timer size={14} className="text-slate-400" />
                        {toDate(it.eta)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
