'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Factory, Palette, Timer } from 'lucide-react'

type StockRow = {
  id: string
  status: 'READY'
  quantity: number
  eta: string | null
  imageUrl: string | null
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
  const [mounted, setMounted] = useState(false)
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!previewImage) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [previewImage])

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/dealer/in-stock', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.message || 'Failed to load stock')
        setItems(Array.isArray(json?.items) ? json.items : [])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load stock')
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

  const previewModal =
    mounted && previewImage
      ? createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-[2px]"
            onClick={() => setPreviewImage(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Stock photo preview"
          >
            <div
              className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_30px_100px_rgba(2,8,23,0.45)] sm:p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-semibold text-slate-800 truncate">
                  {previewImage.title}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  aria-label="Close image preview"
                >
                  ✕
                </button>
              </div>

              <div className="flex h-[68vh] min-h-[320px] max-h-[760px] items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-2">
                <img
                  src={previewImage.url}
                  alt={previewImage.title}
                  className="h-auto max-h-full w-auto max-w-full object-contain"
                />
              </div>
            </div>
          </div>,
          document.body
        )
      : null

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
                  <th className="py-2 pr-3">Photo</th>
                  <th className="py-2 pr-3">Factory</th>
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Color</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3">ETA</th>
                  <th className="py-2 pr-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="py-3 pr-3">
                      <div className="h-12 w-16 overflow-hidden rounded border border-slate-200 bg-slate-50">
                        {it.imageUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: it.imageUrl as string,
                                title: `${it.poolModel?.name || 'Pool'} • ${it.color?.name || 'No color'}`,
                              })
                            }
                            className="h-full w-full cursor-zoom-in"
                            title="Click to view full photo"
                          >
                            <img
                              src={it.imageUrl}
                              alt={`${it.poolModel?.name} stock`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="h-full w-full text-[10px] text-slate-400 flex items-center justify-center">
                            No photo
                          </div>
                        )}
                      </div>
                    </td>
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
                    <td className="py-3 pr-3 text-right">
                      {it.color?.id ? (
                        <a
                          href={`/dealer/new-order?poolModelId=${encodeURIComponent(it.poolModel.id)}&colorId=${encodeURIComponent(it.color.id)}&poolStockId=${encodeURIComponent(it.id)}`}
                          className="inline-flex h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          Order this stock
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Select in order form</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewModal}
    </div>
  )
}
