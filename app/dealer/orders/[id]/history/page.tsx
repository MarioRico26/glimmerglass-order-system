// Parte 1/3
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

type Order = {
  id: string
  poolModel: { name: string }
  color: { name: string }
  deliveryAddress: string
  factory: { name: string }
  paymentProofUrl?: string | null
  hardwareSkimmer?: boolean
  hardwareAutocover?: boolean
  hardwareReturns?: boolean
  hardwareMainDrains?: boolean
  dealer: { name: string; email: string }
}

const aqua = '#00B2CA'
const deep = '#007A99'

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
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const normalizedMedia = useMemo(() => {
    return media.map((m) => ({ ...m, fileUrl: m.fileUrl ?? m.url ?? '' }))
  }, [media])

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [history]
  )

  const selectedHardware = useMemo(() => {
    if (!order) return []
    return [
      order.hardwareSkimmer && 'Skimmer',
      order.hardwareAutocover && 'Auto Cover',
      order.hardwareReturns && 'Returns',
      order.hardwareMainDrains && 'Main Drains',
    ].filter(Boolean)
  }, [order])

  useEffect(() => {
    let abort = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const hRes = await fetch(`/api/dealer/orders/${orderId}/history`)
        const hJson = await hRes.json()
        if (!abort) {
          if (hRes.ok) {
            setHistory(hJson.history ?? [])
            setOrder(hJson.order ?? null)
          } else {
            throw new Error(hJson?.message || 'Failed to load history')
          }
        }

        const mRes = await fetch(`/api/admin/orders/${orderId}/media`)
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
      {/* ENCABEZADO */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Order History</h1>
        <p className="text-slate-600">Timeline, media, and hardware summary.</p>
      </div>

      {/* RESUMEN DE LA ORDEN */}
      {order && (
        <div className="mb-8 rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.10)] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
            <div>
              <strong className="text-slate-900">Dealer:</strong> {order.dealer.name} ({order.dealer.email})
            </div>
            <div>
              <strong className="text-slate-900">Pool:</strong> {order.poolModel.name} - {order.color.name}
            </div>
            <div>
              <strong className="text-slate-900">Delivery Address:</strong> {order.deliveryAddress}
            </div>
            <div>
              <strong className="text-slate-900">Factory:</strong> {order.factory.name}
            </div>
            {selectedHardware.length > 0 && (
              <div className="md:col-span-2">
                <strong className="text-slate-900">Hardware:</strong> {selectedHardware.join(', ')}
                <p className="text-xs text-slate-500 mt-1">
                  (Skimmer, Main Drain, Returns included and shipped loose. $125 per penetration if installed by Glimmerglass)
                </p>
              </div>
            )}
          </div>
        </div>
      )}