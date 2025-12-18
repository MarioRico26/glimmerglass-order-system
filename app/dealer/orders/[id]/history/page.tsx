// glimmerglass-order-system/app/dealer/orders/[id]/history/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Clock,
  CheckCircle2,
  CircleCheckBig,
  CircleX,
  BadgeDollarSign,
  AlertCircle,
  FileDown,
} from 'lucide-react'

import { STATUS_LABELS, labelDocType, type FlowStatus } from '@/lib/orderFlow'

type OrderHistory = {
  id: string
  status: string
  comment?: string | null
  createdAt: string
}

type OrderMedia = {
  id: string
  type: string
  docType?: string | null
  uploadedAt?: string
  fileUrl?: string
  url?: string
}

const aqua = '#00B2CA'
const deep = '#007A99'

function toApiUrl(u: string) {
  if (!u) return ''
  return u.startsWith('/uploads/') ? '/api/uploads/' + u.replace('/uploads/', '') : u
}

// ✅ APPROVED eliminado
const STATUS_META: Record<string, { icon: any; badge: string }> = {
  PENDING_PAYMENT_APPROVAL: {
    icon: BadgeDollarSign,
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  IN_PRODUCTION: {
    icon: CircleCheckBig,
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  PRE_SHIPPING: {
    icon: Clock,
    badge: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  COMPLETED: {
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  CANCELED: {
    icon: CircleX,
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
  },
}

// ✅ evita el error TS: h.status es string, STATUS_LABELS espera FlowStatus
function labelStatus(status: string) {
  const key = status as FlowStatus
  return STATUS_LABELS[key] ?? status.replaceAll('_', ' ')
}

export default function DealerOrderHistoryPage() {
  const { id: orderId } = useParams() as { id: string }

  const [history, setHistory] = useState<OrderHistory[]>([])
  const [media, setMedia] = useState<OrderMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const normalizedMedia = useMemo(() => {
    return media.map((m) => ({ ...m, fileUrl: m.fileUrl ?? m.url ?? '' }))
  }, [media])

  const sortedHistory = useMemo(() => {
    return [...history].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }, [history])

  useEffect(() => {
    let abort = false

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const hRes = await fetch(`/api/dealer/orders/${orderId}/history`, { cache: 'no-store' })
        const hJson = await hRes.json().catch(() => null)
        if (!hRes.ok) throw new Error(hJson?.message || `Failed to load history (${hRes.status})`)

        const mRes = await fetch(`/api/orders/${orderId}/media`, { cache: 'no-store' })
        const mJson = await mRes.json().catch(() => null)
        if (!mRes.ok) throw new Error(mJson?.message || `Failed to load files (${mRes.status})`)

        if (!abort) {
          setHistory(Array.isArray(hJson) ? hJson : [])
          setMedia(Array.isArray(mJson) ? mJson : [])
        }
      } catch (e: any) {
        if (!abort) setError(e?.message || 'Error loading data')
      } finally {
        if (!abort) setLoading(false)
      }
    })()

    return () => {
      abort = true
    }
  }, [orderId])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Order History &amp; Files</h1>
        <p className="text-slate-600">Timeline updates and dealer-visible documents for this order.</p>
      </div>

      {/* TIMELINE */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Timeline</h3>
          <div
            className="h-1 w-28 rounded-full"
            style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 text-rose-700 px-3 py-2 inline-flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        ) : sortedHistory.length === 0 ? (
          <div className="text-slate-600">No history entries found.</div>
        ) : (
          <div className="relative pl-5">
            <div
              className="absolute left-2.5 top-0 bottom-0 w-[3px] rounded-full opacity-40"
              style={{ backgroundImage: `linear-gradient(${aqua}, ${deep})` }}
            />
            <div className="space-y-4">
              {sortedHistory.map((h) => {
                const meta = STATUS_META[h.status] || {
                  icon: Clock,
                  badge: 'bg-slate-50 text-slate-800 border-slate-200',
                }
                const Icon = meta.icon
                const title = labelStatus(h.status)

                return (
                  <div key={h.id} className="relative">
                    <div className="absolute -left-0.5 top-1.5 w-6 h-6 rounded-full border bg-white flex items-center justify-center shadow-sm ring-2 ring-[#007A99]">
                      <Icon size={14} className="text-[#007A99]" />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 pl-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={[
                              'inline-flex items-center gap-2 border px-2 py-1 rounded-full text-xs font-semibold',
                              meta.badge,
                            ].join(' ')}
                          >
                            {title}
                          </div>

                          {h.comment ? (
                            <div className="mt-2 text-[13px] text-slate-700 whitespace-pre-wrap">
                              {h.comment}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(h.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* FILES */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-900">Files</h3>
          <div className="text-xs text-slate-500">Dealer-visible only</div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 text-rose-700 px-3 py-2 inline-flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        ) : normalizedMedia.length === 0 ? (
          <div className="text-slate-600">No files available yet.</div>
        ) : (
          <div className="grid gap-3">
            {normalizedMedia.map((m) => {
              const href = toApiUrl(m.fileUrl || '')
              const docLabel = labelDocType(m.docType)
              const fallbackLabel = m.type ? m.type.replaceAll('_', ' ') : 'File'

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {docLabel || fallbackLabel}
                      </span>

                      <span className="text-[11px] rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600 capitalize">
                        {m.type}
                      </span>
                    </div>

                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-2 text-sm text-sky-700 hover:underline truncate max-w-[70ch]"
                      title="View / Download"
                    >
                      <FileDown size={16} />
                      View / Download
                    </a>

                    {m.uploadedAt ? (
                      <div className="text-[11px] text-slate-500 mt-1">
                        Uploaded: {new Date(m.uploadedAt).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div
        className="mt-8 h-1 w-full rounded-full"
        style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
      />
    </div>
  )
}