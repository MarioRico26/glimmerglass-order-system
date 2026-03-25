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
  type LucideIcon,
} from 'lucide-react'

import BlueprintMarkersCard, { type BlueprintMarker } from '@/components/orders/BlueprintMarkersCard'
import { labelDocType, labelOrderStatus } from '@/lib/orderFlow'
import { useWorkflowDocLabels } from '@/hooks/useWorkflowDocLabels'

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
  uploadedByRole?: string | null
  uploadedByDisplayName?: string | null
  uploadedByEmail?: string | null
}

type DealerOrderSummary = {
  id: string
  poolModel?: { name: string; blueprintUrl?: string | null; hasIntegratedSpa?: boolean } | null
  color?: { name: string } | null
  blueprintMarkers?: BlueprintMarker[]
  penetrationMode?: string | null
  penetrationNotes?: string | null
  hardwareAutocover?: boolean
  requestedShipDate?: string | null
  scheduledShipDate?: string | null
  serialNumber?: string | null
  job?: {
    id: string
    role?: string | null
    itemType?: string | null
    linkedOrders: Array<{
      id: string
      status: string
      serialNumber?: string | null
      scheduledShipDate?: string | null
      role?: string | null
      itemType?: string | null
      poolModel?: { name: string } | null
      color?: { name: string } | null
    }>
  } | null
}

const aqua = '#00B2CA'
const deep = '#007A99'

function toApiUrl(u: string) {
  if (!u) return ''
  return u.startsWith('/uploads/') ? '/api/uploads/' + u.replace('/uploads/', '') : u
}

const STATUS_META: Record<string, { icon: LucideIcon; badge: string }> = {
  PENDING_PAYMENT_APPROVAL: {
    icon: BadgeDollarSign,
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  APPROVED: {
    icon: CircleCheckBig,
    badge: 'bg-sky-50 text-sky-800 border-sky-200',
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
  SERVICE_WARRANTY: {
    icon: CircleCheckBig,
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  },
  CANCELED: {
    icon: CircleX,
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
  },
}

function labelStatus(status: string) {
  return labelOrderStatus(status, { preserveLegacyApproved: true })
}

function formatUploader(media: Pick<OrderMedia, 'uploadedByDisplayName' | 'uploadedByEmail'>) {
  const displayName = media.uploadedByDisplayName?.trim()
  const email = media.uploadedByEmail?.trim()
  if (displayName && email) return `${displayName} • ${email}`
  if (displayName) return displayName
  if (email) return email
  return 'Legacy upload'
}

export default function DealerOrderHistoryPage() {
  const { id: orderId } = useParams() as { id: string }

  const [history, setHistory] = useState<OrderHistory[]>([])
  const [media, setMedia] = useState<OrderMedia[]>([])
  const [summary, setSummary] = useState<DealerOrderSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { labelForDocType } = useWorkflowDocLabels()

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

        const [hRes, mRes, sRes] = await Promise.all([
          fetch(`/api/dealer/orders/${orderId}/history`, { cache: 'no-store' }),
          fetch(`/api/orders/${orderId}/media`, { cache: 'no-store' }),
          fetch(`/api/dealer/orders/${orderId}/summary`, { cache: 'no-store' }),
        ])

        const hJson = await hRes.json().catch(() => null)
        if (!hRes.ok) throw new Error(hJson?.message || `Failed to load history (${hRes.status})`)

        const mJson = await mRes.json().catch(() => null)
        if (!mRes.ok) throw new Error(mJson?.message || `Failed to load files (${mRes.status})`)

        const sJson = await sRes.json().catch(() => null)
        if (!sRes.ok) throw new Error(sJson?.message || `Failed to load order summary (${sRes.status})`)

        if (!abort) {
          setHistory(Array.isArray(hJson) ? hJson : [])
          setMedia(Array.isArray(mJson) ? mJson : [])
          setSummary(sJson && typeof sJson === 'object' ? (sJson as DealerOrderSummary) : null)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error loading data'
        if (!abort) setError(msg)
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

      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5 mb-6">
        <BlueprintMarkersCard
          title="Dig Sheet Markers"
          subtitle={
            summary?.poolModel?.hasIntegratedSpa
              ? 'Skimmer, Main Drains, and Returns included (white only). Standard fitting placement shown above—please indicate on schematic if alternate placement is necessary. Spa jet configuration follows the integrated spa schematic.'
              : 'Skimmer, Main Drains, and Returns included (white only). Standard fitting placement shown above—please indicate on schematic if alternate placement is necessary. (Standard placement only on Main Drains)'
        }
          blueprintUrl={summary?.poolModel?.blueprintUrl ?? null}
          markers={summary?.blueprintMarkers ?? []}
        />
      </div>

      {summary?.job ? (
        <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Linked Job</h3>
              <p className="text-sm text-slate-600">
                Scheduling can be coordinated across linked orders. Status, serial number, files and history are tracked per order.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
              {summary.job.itemType === 'SPA' ? 'Linked Spa' : 'Linked Pool'}
            </span>
          </div>

          {summary.job.linkedOrders.length ? (
            <div className="mt-4 grid gap-3">
              {summary.job.linkedOrders.map((linked) => (
                <div key={linked.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="font-semibold text-slate-900">
                    {linked.poolModel?.name || 'Linked order'}
                    {linked.color?.name ? ` • ${linked.color.name}` : ''}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {linked.itemType === 'SPA' ? 'Spa item' : 'Pool item'} • {labelStatus(linked.status)}
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-slate-700">
                    <div>
                      <span className="text-slate-500">Scheduled ship date:</span>{' '}
                      {linked.scheduledShipDate ? new Date(linked.scheduledShipDate).toLocaleDateString() : 'Not set'}
                    </div>
                    <div>
                      <span className="text-slate-500">Serial number:</span> {linked.serialNumber || 'Not assigned'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

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
              const docLabel = labelForDocType(m.docType) || labelDocType(m.docType)
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
                      <>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Uploaded: {new Date(m.uploadedAt).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Uploaded by: {formatUploader(m)}
                        </div>
                      </>
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
