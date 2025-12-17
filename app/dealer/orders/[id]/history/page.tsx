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
  ImageDown,
  FileDown,
} from 'lucide-react'

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
  return u.startsWith('/uploads/')
    ? '/api/uploads/' + u.replace('/uploads/', '')
    : u
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending Payment Approval',
  APPROVED: 'Approved',
  IN_PRODUCTION: 'In Production',
  PRE_SHIPPING: 'Pre-Shipping',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

const statusIcon: Record<string, any> = {
  PENDING_PAYMENT_APPROVAL: BadgeDollarSign,
  APPROVED: CheckCircle2,
  IN_PRODUCTION: CircleCheckBig,
  PRE_SHIPPING: CircleCheckBig,
  COMPLETED: CheckCircle2,
  CANCELED: CircleX,
}

const statusBadge: Record<string, string> = {
  PENDING_PAYMENT_APPROVAL: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-sky-50 text-sky-800 border-sky-200',
  IN_PRODUCTION: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  PRE_SHIPPING: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELED: 'bg-rose-50 text-rose-800 border-rose-200',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  OTHER: 'Other',

  PROOF_OF_PAYMENT: 'Proof of Payment',
  QUOTE: 'Quote',
  INVOICE: 'Invoice',
  PROOF_OF_FINAL_PAYMENT: 'Proof of Final Payment',
  PAID_INVOICE: 'Paid Invoice',
  BILL_OF_LADING: 'Bill of Lading',

  BUILD_SHEET: 'Build Sheet',
  POST_PRODUCTION_MEDIA: 'Post-production Photos/Video',

  SHIPPING_CHECKLIST: 'Shipping Checklist',
  PRE_SHIPPING_MEDIA: 'Pre-shipping Photos/Video',

  WARRANTY: 'Warranty',
  MANUAL: 'Manual',
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
    const arr = [...history].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    return arr
  }, [history])

  useEffect(() => {
    let abort = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const hRes = await fetch(`/api/dealer/orders/${orderId}/history`, { cache: 'no-store' })
        const hJson = await hRes.json()
        if (!abort) {
          if (hRes.ok) setHistory(Array.isArray(hJson) ? hJson : [])
          else throw new Error(hJson?.message || 'Failed to load history')
        }

        // ✅ Dealer must use dealer endpoint (filters visibleToDealer + ownership)
        const mRes = await fetch(`/api/orders/${orderId}/media`, { cache: 'no-store' })
        const mJson = await mRes.json()
        if (!abort) {
          if (mRes.ok) setMedia(Array.isArray(mJson) ? mJson : [])
          else throw new Error(mJson?.message || 'Failed to load files')
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Order History</h1>
        <p className="text-slate-600">Timeline and files for this order.</p>
      </div>

      {/* TIMELINE CARD */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Timeline</h3>
          <div
            className="h-1 w-24 rounded-full"
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
          <div className="text-slate-600">No history found.</div>
        ) : (
          <>
            {/* Desktop: clearer horizontal timeline */}
            <div className="hidden md:block">
              <div className="relative">
                {/* line ABOVE cards (no crossing text) */}
                <div className="relative h-14">
                  <div
                    className="absolute left-2 right-2 top-7 h-[4px] rounded-full opacity-35"
                    style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
                  />
                </div>

                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${sortedHistory.length}, minmax(0, 1fr))` }}
                >
                  {sortedHistory.map((h) => {
                    const Icon = statusIcon[h.status] ?? Clock
                    const badgeClass =
                      statusBadge[h.status] ?? 'bg-slate-50 text-slate-800 border-slate-200'
                    const title = STATUS_LABELS[h.status] || h.status.replaceAll('_', ' ')

                    return (
                      <div key={h.id} className="relative">
                        {/* Node aligned to the line */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-[36px]">
                          <div className="relative">
                            <div className="absolute inset-0 rounded-full blur-md bg-[#00B2CA]/20" />
                            <div className="relative w-11 h-11 rounded-full bg-white border shadow-sm ring-2 ring-[#007A99] flex items-center justify-center">
                              <Icon size={18} className="text-[#007A99]" />
                            </div>
                          </div>
                        </div>

                        {/* Card */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 pt-6 shadow-sm">
                          <div className="flex items-center justify-center mb-2">
                            <span className={`inline-flex items-center border px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                              {title}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 text-center">
                            {new Date(h.createdAt).toLocaleString()}
                          </div>

                          {h.comment ? (
                            <div className="mt-2 text-[13px] text-slate-700 text-center">
                              {h.comment}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Mobile: vertical timeline */}
            <div className="md:hidden">
              <div className="relative pl-5">
                <div
                  className="absolute left-2.5 top-0 bottom-0 w-[3px] rounded-full opacity-40"
                  style={{ backgroundImage: `linear-gradient(${aqua}, ${deep})` }}
                />
                <div className="space-y-4">
                  {sortedHistory.map((h) => {
                    const Icon = statusIcon[h.status] ?? Clock
                    const badgeClass =
                      statusBadge[h.status] ?? 'bg-slate-50 text-slate-800 border-slate-200'
                    const title = STATUS_LABELS[h.status] || h.status.replaceAll('_', ' ')

                    return (
                      <div key={h.id} className="relative">
                        <div className="absolute left-1 top-1 w-6 h-6 rounded-full blur-md bg-[#00B2CA]/25" />
                        <div className="absolute -left-0.5 top-1.5 w-5 h-5 rounded-full border bg-white flex items-center justify-center shadow-sm ring-2 ring-[#007A99]">
                          <Icon size={12} className="text-[#007A99]" />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 pl-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className={`inline-flex items-center border px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                              {title}
                            </div>
                            <div className="text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(h.createdAt).toLocaleString()}
                            </div>
                          </div>

                          {h.comment ? (
                            <div className="mt-2 text-[13px] text-slate-700">
                              {h.comment}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* FILES CARD */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-900">Files</h3>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded bg-slate-100" />
            ))}
          </div>
        ) : normalizedMedia.length === 0 ? (
          <div className="text-slate-600">No files found.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {normalizedMedia.map((m) => {
              const href = toApiUrl(m.fileUrl || '')
              const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(href)
              const isPdf = /\.pdf$/i.test(href)

              const title = m.docType
                ? (DOC_TYPE_LABELS[m.docType] || m.docType.replaceAll('_', ' '))
                : (m.type || 'file')

              return (
                <a
                  key={m.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-slate-200 bg-white hover:bg-slate-50 p-3 flex flex-col gap-2 transition shadow-sm hover:shadow-md"
                  title="View / Download"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 truncate">
                      {title}
                    </span>

                    {isImage ? (
                      <ImageDown size={18} className="text-slate-500 group-hover:text-slate-700" />
                    ) : (
                      <FileDown size={18} className="text-slate-500 group-hover:text-slate-700" />
                    )}
                  </div>

                  <div className="text-xs text-slate-500">
                    {m.uploadedAt ? new Date(m.uploadedAt).toLocaleString() : ''}
                  </div>

                  <div className="text-[13px] font-semibold text-slate-800 group-hover:underline">
                    {isPdf ? 'Open PDF' : isImage ? 'Open image' : 'Open file'}
                  </div>
                </a>
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