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
  uploadedAt?: string
  fileUrl?: string
  url?: string
}

const aqua = '#00B2CA'
const deep = '#007A99'

// Opcional: proxy si sirves /uploads por /api/uploads
function toApiUrl(u: string) {
  if (!u) return ''
  return u.startsWith('/uploads/')
    ? '/api/uploads/' + u.replace('/uploads/', '')
    : u
}

const statusIcon: Record<string, any> = {
  PENDING_PAYMENT_APPROVAL: BadgeDollarSign,
  APPROVED: CheckCircle2,
  IN_PRODUCTION: CircleCheckBig,
  COMPLETED: CheckCircle2,
  CANCELED: CircleX,
}

const statusColor: Record<string, string> = {
  PENDING_PAYMENT_APPROVAL: 'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-sky-100 text-sky-700 border-sky-200',
  IN_PRODUCTION: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CANCELED: 'bg-rose-100 text-rose-700 border-rose-200',
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

  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [history]
  )

  useEffect(() => {
    let abort = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const hRes = await fetch(/api/dealer/orders/${orderId}/history)
        const hJson = await hRes.json()
        if (!abort) {
          if (hRes.ok) setHistory(Array.isArray(hJson) ? hJson : [])
          else throw new Error(hJson?.message || 'Failed to load history')
        }

        const mRes = await fetch(/api/admin/orders/${orderId}/media)
        const mJson = await mRes.json()
        if (!abort) {
          if (mRes.ok) setMedia(Array.isArray(mJson) ? mJson : [])
          else throw new Error(mJson?.message || 'Failed to load media')
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
            style={{ backgroundImage: linear-gradient(90deg, ${aqua}, ${deep}) }}
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
            {/* Horizontal timeline (≥ md) */}
            <div className="hidden md:block">
              <div className="relative px-2 py-8">
                {/* Línea base */}
                <div
                  className="absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full opacity-40"
                  style={{ backgroundImage: linear-gradient(90deg, ${aqua}, ${deep}) }}
                />
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: repeat(${sortedHistory.length}, minmax(0,1fr)),
                  }}
                >
                  {sortedHistory.map((h, idx) => {
                    const Icon = statusIcon[h.status] ?? Clock
                    const badge =
                      statusColor[h.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                    const isLast = idx === sortedHistory.length - 1
                    return (
                      <div key={h.id} className="relative flex flex-col items-center px-2">
                        {/* tramo resaltado hasta el nodo */}
                        <div
                          className="absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full"
                          style={{
                            backgroundImage: linear-gradient(90deg, ${aqua}, ${deep}),
                            opacity: isLast ? 0.9 : 0.65,
                          }}
                        />
                        {/* Glow */}
                        <div className="absolute top-[calc(50%-22px)] w-11 h-11 rounded-full blur-md bg-[#00B2CA]/20" />
                        {/* Nodo */}
                        <div
                          className="relative z-10 flex items-center justify-center w-11 h-11 rounded-full border bg-white shadow-sm ring-2 ring-[#007A99]"
                          title={h.status}
                        >
                          <Icon size={18} className="text-[#007A99]" />
                        </div>
                        {/* Etiquetas */}
                        <div className="mt-3 text-center">
                          <div
                            className={inline-flex items-center gap-2 border px-2 py-1 rounded-full text-xs font-semibold ${badge}}
                          >
                            {h.status.replaceAll('_', ' ')}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(h.createdAt).toLocaleString()}
                          </div>
                          {h.comment ? (
                            <div className="mt-1 text-[13px] text-slate-700 max-w-[16rem] mx-auto">
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

            {/* Vertical timeline (< md) */}
            <div className="md:hidden">
              <div className="relative pl-5">
                <div
                  className="absolute left-2.5 top-0 bottom-0 w-[3px] rounded-full opacity-40"
                  style={{ backgroundImage: linear-gradient(${aqua}, ${deep}) }}
                />
                <div className="space-y-4">
                  {sortedHistory.map((h) => {
                    const Icon = statusIcon[h.status] ?? Clock
                    const badge =
                      statusColor[h.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                    return (
                      <div key={h.id} className="relative">
                        {/* Glow */}
                        <div className="absolute left-1 top-1 w-6 h-6 rounded-full blur-md bg-[#00B2CA]/25" />
                        {/* Nodo */}
                        <div className="absolute -left-0.5 top-1.5 w-5 h-5 rounded-full border bg-white flex items-center justify-center shadow-sm ring-2 ring-[#007A99]">
                          <Icon size={12} className="text-[#007A99]" />
                        </div>
                        {/* Contenido */}
                        <div className="rounded-xl border border-slate-200 bg-white p-3 pl-4">
                          <div className="flex items-center justify-between">
                            <div
                              className={inline-flex items-center gap-2 border px-2 py-1 rounded-full text-xs font-semibold ${badge}}
                            >
                              {h.status.replaceAll('_', ' ')}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {new Date(h.createdAt).toLocaleString()}
                            </div>
                          </div>
                          {h.comment ? (
                            <div className="mt-2 text-[13px] text-slate-700">{h.comment}</div>
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
          <div className="text-slate-600">No media files found.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {normalizedMedia.map((m) => {
              const href = toApiUrl(m.fileUrl || '')
              const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(href)
              const isPdf = /\.pdf$/i.test(href)
              return (
                <a
                  key={m.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="group rounded-xl border border-slate-200 bg-white hover:bg-slate-50 p-3 flex flex-col gap-2 transition shadow-sm hover:shadow-md"
                  title="View / Download"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 capitalize">
                      {m.type}
                    </span>
                    {isImage ? (
                      <ImageDown size={18} className="text-slate-500 group-hover:text-slate-700" />
                    ) : (
                      <FileDown size={18} className="text-slate-500 group-hover:text-slate-700" />
                    )}
                  </div>
                  {m.uploadedAt && (
                    <div className="text-xs text-slate-500">
                      {new Date(m.uploadedAt).toLocaleString()}
                    </div>
                  )}
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
        style={{ backgroundImage: linear-gradient(90deg, ${aqua}, ${deep}) }}
      />
    </div>
  )
}