//glimmerglass-order-system/app/(admin)/admin/orders/[id]/history/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, PencilLine, Trash2, TriangleAlert } from 'lucide-react'

import AddManualEntryModal from '@/components/admin/AddManualEntry'
import ProductionBuildRecordCard from '@/components/admin/ProductionBuildRecordCard'
import BlueprintMarkersCard, { type BlueprintMarker } from '@/components/orders/BlueprintMarkersCard'
import { labelDocType, labelOrderStatus } from '@/lib/orderFlow'
import { useWorkflowDocLabels } from '@/hooks/useWorkflowDocLabels'
import { formatDateOnlyForDisplay, formatDateOnlyForInput } from '@/lib/dateOnly'
import { displayInvoiceRef } from '@/lib/invoiceRef'

interface OrderHistory {
  id: string
  status: string
  comment?: string
  createdAt: string
  user?: { email: string }
}

interface OrderMedia {
  id: string
  fileUrl: string
  type: string
  docType?: string | null
  uploadedAt: string
  uploadedByRole?: string | null
  uploadedByDisplayName?: string | null
  uploadedByEmail?: string | null
}

interface OrderSummary {
  id: string
  deliveryAddress: string
  notes?: string | null
  status: string
  paymentProofUrl?: string | null
  blueprintMarkers?: BlueprintMarker[]
  penetrationMode?: string | null
  penetrationNotes?: string | null

  dealer?: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
  } | null

  poolModel?: { name: string; blueprintUrl?: string | null; hasIntegratedSpa?: boolean } | null
  color?: { name: string } | null
  factory?: { id: string; name: string } | null
  allocatedPoolStock?: {
    id: string
    status: string
    quantity: number
    serialNumber?: string | null
    productionDate?: string | null
    notes?: string | null
    factory?: { id: string; name: string } | null
  } | null
  shippingMethod?: string | null

  hardwareSkimmer: boolean
  hardwareReturns: boolean
  hardwareAutocover: boolean
  hardwareMainDrains: boolean

  requestedShipDate?: string | null
  requestedShipDateInput?: string | null
  requestedShipAsap?: boolean
  scheduledShipDate?: string | null
  serialNumber?: string | null
  invoiceNumber?: string | null
  productionPriority?: number | null
  job?: {
    id: string
    role?: string | null
    itemType?: string | null
    linkedOrders: Array<{
      id: string
      status: string
      role?: string | null
      itemType?: string | null
      poolModel?: { name: string } | null
      color?: { name: string } | null
    }>
  } | null
}

interface FactoryLocation {
  id: string
  name: string
  city?: string | null
  state?: string | null
}

const SHIPPING_LABELS: Record<string, string> = {
  PICK_UP: 'Pick Up',
  QUOTE: 'Glimmerglass Freight (quote to be provided)',
}

function labelPenetrationMode(mode?: string | null) {
  switch (mode) {
    case 'NO_PENETRATIONS':
      return 'No penetrations (whitegoods ship loose)'
    case 'PENETRATIONS_WITHOUT_INSTALL':
      return 'Glimmerglass cuts penetrations (whitegoods ship loose)'
    case 'PENETRATIONS_WITH_INSTALL':
      return 'Glimmerglass installs hardware ($75 per return/main drain, skimmer ships loose)'
    case 'OTHER':
      return 'Other'
    default:
      return 'Not set'
  }
}

interface AllocationCandidate {
  id: string
  status: string
  quantity: number
  serialNumber?: string | null
  productionDate?: string | null
  notes?: string | null
  factory?: { id: string; name: string } | null
  allocatedToOtherOrder: boolean
  allocatedOrder?: {
    id: string
    dealerName?: string | null
  } | null
}

interface PoolStockAllocationPayload {
  order: {
    id: string
    status: string
    allocatedPoolStockId?: string | null
  }
  currentAllocation?: AllocationCandidate | null
  canAllocate: boolean
  candidates: AllocationCandidate[]
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function extractItems<T>(value: T[] | { items: T[] } | null): T[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object' && 'items' in value && Array.isArray(value.items)) {
    return value.items
  }
  return []
}

function formatUploader(media: Pick<OrderMedia, 'uploadedByDisplayName' | 'uploadedByEmail'>) {
  const displayName = media.uploadedByDisplayName?.trim()
  const email = media.uploadedByEmail?.trim()
  if (displayName && email) return `${displayName} • ${email}`
  if (displayName) return displayName
  if (email) return email
  return 'Legacy upload'
}

function shippingMethodLabel(value?: string | null) {
  if (!value) return 'Not set'
  return SHIPPING_LABELS[value] || value
}

export default function OrderHistoryPage() {
  const params = useParams()
  const orderId = params.id as string

  const [summary, setSummary] = useState<OrderSummary | null>(null)
  const [history, setHistory] = useState<OrderHistory[]>([])
  const [mediaFiles, setMediaFiles] = useState<OrderMedia[]>([])
  const [factoryList, setFactoryList] = useState<FactoryLocation[]>([])
  const [allocation, setAllocation] = useState<PoolStockAllocationPayload | null>(null)
  const [selectedAllocationStockId, setSelectedAllocationStockId] = useState('')

  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<string>('')

  const [editRequestedDate, setEditRequestedDate] = useState<string>('') // yyyy-mm-dd
  const [editRequestedShipAsap, setEditRequestedShipAsap] = useState(false)
  const [editSerialNumber, setEditSerialNumber] = useState<string>('')
  const [editInvoiceNumber, setEditInvoiceNumber] = useState<string>('')
  const [editPriority, setEditPriority] = useState<string>('')
  const [editDeliveryAddress, setEditDeliveryAddress] = useState<string>('')
  const [editNotes, setEditNotes] = useState<string>('')
  const [editPenetrationMode, setEditPenetrationMode] = useState<string>('')
  const [editPenetrationNotes, setEditPenetrationNotes] = useState<string>('')
  const [editAutocover, setEditAutocover] = useState(false)

  const [editing, setEditing] = useState(false)
  const [mounted, setMounted] = useState(false)

  // ✅ usa tu modal real
  const [manualOpen, setManualOpen] = useState(false)

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allocating, setAllocating] = useState(false)
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null)
  const [photoGalleryExpanded, setPhotoGalleryExpanded] = useState(false)
  const { labelForDocType } = useWorkflowDocLabels()
  const hasAllocatedStock = !!summary?.allocatedPoolStock
  const photoMedia = mediaFiles.filter((item) => item.type === 'photo')
  const documentMedia = mediaFiles.filter((item) => item.type !== 'photo')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !editing) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mounted, editing])

  const loadAll = async () => {
    try {
      setLoading(true)

      const [orderRes, historyRes, mediaRes, factoriesRes, allocationRes] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/status`, { cache: 'no-store' }),
        fetch(`/api/admin/orders/${orderId}/history`, { cache: 'no-store' }),
        fetch(`/api/admin/orders/${orderId}/media`, { cache: 'no-store' }),
        fetch(`/api/factories`, { cache: 'no-store' }),
        fetch(`/api/admin/orders/${orderId}/pool-stock-allocation`, { cache: 'no-store' }),
      ])

      const orderData = await safeJson<OrderSummary>(orderRes)
      const historyData = await safeJson<OrderHistory[] | { items: OrderHistory[] }>(historyRes)
      const mediaData = await safeJson<OrderMedia[] | { items: OrderMedia[] }>(mediaRes)
      const factoriesData = await safeJson<FactoryLocation[]>(factoriesRes)
      const allocationData = await safeJson<PoolStockAllocationPayload>(allocationRes)

      if (orderData) {
        setSummary(orderData)

        setSelectedFactoryId(orderData.factory?.id || '')
        setSelectedShippingMethod(orderData.shippingMethod || '')
        setEditDeliveryAddress(orderData.deliveryAddress || '')
        setEditNotes(orderData.notes || '')
        setEditPenetrationMode(orderData.penetrationMode || '')
        setEditPenetrationNotes(orderData.penetrationNotes || '')
        setEditAutocover(!!orderData.hardwareAutocover)

        setEditRequestedDate(orderData.requestedShipDateInput || formatDateOnlyForInput(orderData.requestedShipDate))
        setEditRequestedShipAsap(!!orderData.requestedShipAsap)
        setEditSerialNumber(orderData.serialNumber || '')
        setEditInvoiceNumber(orderData.invoiceNumber || '')
        setEditPriority(typeof orderData.productionPriority === 'number' ? String(orderData.productionPriority) : '')
      } else {
        setMessage('❌ Failed to load order data')
      }

      setHistory(extractItems(historyData))
      setMediaFiles(extractItems(mediaData))
      if (allocationData) {
        setAllocation(allocationData)
        setSelectedAllocationStockId((current) => {
          if (allocationData.currentAllocation?.id) return allocationData.currentAllocation.id
          if (current && allocationData.candidates.some((candidate) => candidate.id === current)) return current
          const nextAvailable = allocationData.candidates.find((candidate) => !candidate.allocatedToOtherOrder)
          return nextAvailable?.id || ''
        })
      } else {
        setAllocation(null)
        setSelectedAllocationStockId('')
      }

      if (Array.isArray(factoriesData)) setFactoryList(factoriesData)
    } catch (err) {
      console.error(err)
      setMessage('❌ Error loading order data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const handleSaveChanges = async () => {
    try {
      if (editPenetrationMode === 'OTHER' && !editPenetrationNotes.trim()) {
        setMessage('❌ Other penetration notes are required when penetration option is Other.')
        return
      }
      setSaving(true)
      setMessage('🔄 Saving changes...')

      const body = {
        factoryLocationId: selectedFactoryId || null,
        shippingMethod: selectedShippingMethod || null,
        deliveryAddress: editDeliveryAddress,
        notes: editNotes || null,
        requestedShipDate: editRequestedDate || null,
        requestedShipAsap: editRequestedShipAsap,
        serialNumber: editSerialNumber || null,
        invoiceNumber: editInvoiceNumber || null,
        productionPriority: editPriority ? Number(editPriority) : null,
        penetrationMode: editPenetrationMode || null,
        penetrationNotes: editPenetrationNotes || null,
        hardwareAutocover: editAutocover,
      }

      const res = await fetch(`/api/admin/orders/${orderId}/factory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const updated = await safeJson<OrderSummary>(res)

      if (res.ok && updated) {
        setSummary(updated)
        setSelectedFactoryId(updated.factory?.id || '')
        setSelectedShippingMethod(updated.shippingMethod || '')
        setEditDeliveryAddress(updated.deliveryAddress || '')
        setEditNotes(updated.notes || '')
        setEditPenetrationMode(updated.penetrationMode || '')
        setEditPenetrationNotes(updated.penetrationNotes || '')
        setEditAutocover(!!updated.hardwareAutocover)

        setEditRequestedDate(updated.requestedShipDateInput || formatDateOnlyForInput(updated.requestedShipDate))
        setEditRequestedShipAsap(!!updated.requestedShipAsap)
        setEditSerialNumber(updated.serialNumber || '')
        setEditInvoiceNumber(updated.invoiceNumber || '')
        setEditPriority(typeof updated.productionPriority === 'number' ? String(updated.productionPriority) : '')

        setEditing(false)
        setMessage('✅ Changes saved successfully!')
      } else {
        setMessage('❌ Error saving changes. Please try again.')
      }
    } catch (error) {
      console.error('Save error:', error)
      setMessage('❌ Network error. Please check your connection.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleAllocateStock = async () => {
    if (!selectedAllocationStockId) {
      setMessage('❌ Select a pool stock row first.')
      return
    }
    try {
      setAllocating(true)
      setMessage('🔄 Allocating pool stock...')
      const res = await fetch(`/api/admin/orders/${orderId}/pool-stock-allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockId: selectedAllocationStockId }),
      })
      const payload = await safeJson<{ message?: string }>(res)
      if (!res.ok) throw new Error(payload?.message || 'Could not allocate pool stock')
      await loadAll()
      setMessage('✅ Pool stock allocated to order.')
    } catch (error) {
      console.error('Allocate pool stock error:', error)
      const msg = error instanceof Error ? error.message : 'Could not allocate pool stock'
      setMessage(`❌ ${msg}`)
    } finally {
      setAllocating(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleReleaseAllocation = async () => {
    try {
      setAllocating(true)
      setMessage('🔄 Releasing allocated pool stock...')
      const res = await fetch(`/api/admin/orders/${orderId}/pool-stock-allocation`, {
        method: 'DELETE',
      })
      const payload = await safeJson<{ message?: string }>(res)
      if (!res.ok) throw new Error(payload?.message || 'Could not release allocation')
      await loadAll()
      setMessage('✅ Pool stock allocation released.')
    } catch (error) {
      console.error('Release allocation error:', error)
      const msg = error instanceof Error ? error.message : 'Could not release allocation'
      setMessage(`❌ ${msg}`)
    } finally {
      setAllocating(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleDeleteMedia = async (mediaId: string) => {
    const target = mediaFiles.find((item) => item.id === mediaId)
    if (!target) return

    const targetLabel = target.docType
      ? labelForDocType(target.docType) || labelDocType(target.docType) || target.docType
      : target.type
    const confirmed = window.confirm(`Remove "${targetLabel}" from this order? This cannot be undone.`)
    if (!confirmed) return

    try {
      setDeletingMediaId(mediaId)
      setMessage('🔄 Removing file...')

      const res = await fetch(`/api/admin/orders/${orderId}/media?mediaId=${encodeURIComponent(mediaId)}`, {
        method: 'DELETE',
      })
      const payload = await safeJson<{ message?: string }>(res)
      if (!res.ok) {
        setMessage(payload?.message || '❌ Could not remove file.')
        return
      }

      await loadAll()
      setMessage('✅ File removed.')
    } catch (error) {
      console.error('Delete media error:', error)
      setMessage('❌ Network error while removing file.')
    } finally {
      setDeletingMediaId(null)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleApprovePayment = async () => {
    try {
      setSaving(true)
      setMessage('🔄 Approving deposit proof...')

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'IN_PRODUCTION',
          comment: 'Deposit proof approved by admin; order moved to In Production',
        }),
      })

      const payload = await safeJson<{ message?: string; code?: string }>(res)
      if (!res.ok) {
        throw new Error(payload?.message || 'Could not approve deposit proof')
      }

      await loadAll()
      setMessage('✅ Deposit approved and order moved to In Production.')
    } catch (error) {
      console.error('Approve payment error:', error)
      const msg = error instanceof Error ? error.message : 'Could not approve deposit proof'
      setMessage(`❌ ${msg}`)
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (loading) {
    return (
      <div className="w-full p-6 xl:p-8">
        <div className="flex justify-center items-center h-64 text-gray-600">
          Loading order data...
        </div>
      </div>
    )
  }

  const requestedShipText = summary?.requestedShipDate
    ? formatDateOnlyForDisplay(summary.requestedShipDate)
    : 'Not set'
  const scheduledShipText = summary?.scheduledShipDate
    ? formatDateOnlyForDisplay(summary.scheduledShipDate)
    : 'Not scheduled'
  const availableAllocationCandidates = allocation?.candidates.filter((candidate) => !candidate.allocatedToOtherOrder) ?? []
  const hasFinalPaymentProof = mediaFiles.some((file) => file.docType === 'PROOF_OF_FINAL_PAYMENT')
  const blockers = summary
    ? [
        summary.status === 'PENDING_PAYMENT_APPROVAL' && !summary.paymentProofUrl
          ? 'Proof of Deposit has not been uploaded yet.'
          : null,
        summary.status === 'IN_PRODUCTION' && !summary.serialNumber
          ? 'Serial Number is still missing for an active production order.'
          : null,
        summary.status === 'IN_PRODUCTION' && typeof summary.productionPriority !== 'number'
          ? 'Production Priority is not assigned.'
          : null,
        summary.status === 'PRE_SHIPPING' && !summary.scheduledShipDate
          ? 'Scheduled Ship Date is still missing.'
          : null,
        summary.status === 'PRE_SHIPPING' && !hasFinalPaymentProof
          ? 'Proof of Final Payment is still missing.'
          : null,
        summary.allocatedPoolStock && summary.status === 'PRE_SHIPPING' && !summary.scheduledShipDate
          ? 'Finished stock is reserved but shipping is not scheduled.'
          : null,
      ].filter(Boolean) as string[]
    : []

  const nextAction = summary
    ? summary.status === 'PENDING_PAYMENT_APPROVAL' && !summary.paymentProofUrl
      ? {
          title: 'Upload Proof of Deposit',
          detail: 'This order cannot move cleanly into production until the deposit file is attached.',
          href: `/admin/orders/${orderId}/media`,
          cta: 'Open Upload Media',
        }
      : summary.status === 'PENDING_PAYMENT_APPROVAL'
      ? {
          title: 'Approve Deposit and Move to In Production',
          detail: 'Deposit proof is present. The next operational step is to approve it and move the order forward.',
          href: '',
          cta: '',
        }
      : summary.status === 'IN_PRODUCTION' && !summary.serialNumber
      ? {
          title: 'Set Serial Number',
          detail: 'Production is active, but the serial number is still missing on the order.',
          href: '',
          cta: '',
        }
      : summary.status === 'IN_PRODUCTION' && typeof summary.productionPriority !== 'number'
      ? {
          title: 'Assign Production Priority',
          detail: 'This order is in production without a priority value.',
          href: '',
          cta: '',
        }
      : summary.status === 'PRE_SHIPPING' && !hasFinalPaymentProof
      ? {
          title: 'Upload Proof of Final Payment',
          detail: 'Shipping should not close out cleanly until final payment is recorded.',
          href: `/admin/orders/${orderId}/media`,
          cta: 'Open Upload Media',
        }
      : summary.status === 'PRE_SHIPPING' && !summary.scheduledShipDate
      ? {
          title: 'Schedule Ship Date',
          detail: 'This order is already in Pre-Shipping but still does not have a scheduled ship date.',
          href: '/admin/shipping',
          cta: 'Open Ship Schedule',
        }
      : summary.status === 'COMPLETED'
      ? {
          title: 'Review for Service/Warranty Follow-up',
          detail: 'Completed orders can move into Service/Warranty when post-delivery action is needed.',
          href: '',
          cta: '',
        }
      : summary.status === 'SERVICE_WARRANTY'
      ? {
          title: 'Track Warranty / Service Documents',
          detail: 'Use uploaded media and timeline updates to capture the service resolution cleanly.',
          href: `/admin/orders/${orderId}/media`,
          cta: 'Open Upload Media',
        }
      : null
    : null

  return (
    <div className="w-full p-6 xl:p-8">
      {/* ✅ tu modal real (y aquí el error ya sale dentro del modal, no “detrás”) */}
      <AddManualEntryModal
        orderId={orderId}
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        currentStatus={summary?.status ?? null}
        onSuccess={async () => {
          // refresca todo para que status + timeline + media queden actualizados
          await loadAll()
          setMessage('✅ Status updated.')
          setTimeout(() => setMessage(''), 2500)
        }}
      />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900">
          Order Details &amp; History
        </h1>
        <Link
          href="/admin/orders"
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to Orders
        </Link>
      </div>

      {summary && (
        <p className="text-xs text-slate-500 mb-4">
          Order ID: <span className="font-mono">{summary.id}</span>
        </p>
      )}

      {message && (
        <div
          className={`px-4 py-3 rounded-lg mb-6 text-sm font-medium ${
            message.includes('✅')
              ? 'bg-green-50 border border-green-200 text-green-800'
              : message.includes('🔄')
              ? 'bg-blue-50 border border-blue-200 text-blue-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message}
        </div>
      )}

      {summary && (
        <>
          <div className="mb-8 grid gap-4 xl:grid-cols-[1.2fr,0.8fr,0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Operational Summary
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-800">
                  {labelOrderStatus(summary.status)}
                </span>
                {summary.factory?.name ? (
                  <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                    Factory: {summary.factory.name}
                  </span>
                ) : null}
                {summary.color?.name ? (
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    Color: {summary.color.name}
                  </span>
                ) : null}
                {summary.requestedShipAsap ? (
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    ASAP Request
                  </span>
                ) : null}
                {summary.allocatedPoolStock ? (
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    Stock Allocated
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Dealer</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{summary.dealer?.name || 'Not set'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Model</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{summary.poolModel?.name || 'Not set'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Requested Ship</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{requestedShipText}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Scheduled Ship</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{scheduledShipText}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Serial Number</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {summary.serialNumber || <span className="italic text-slate-500">Not set</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Shipping Method</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{shippingMethodLabel(summary.shippingMethod)}</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Next Action</div>
              </div>
              {nextAction ? (
                <div className="mt-4">
                  <div className="text-lg font-black text-slate-900">{nextAction.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{nextAction.detail}</p>
                  {nextAction.href ? (
                    <Link
                      href={nextAction.href}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-100"
                    >
                      {nextAction.cta}
                      <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <button
                      onClick={() => setEditing(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-100"
                    >
                      Edit Order
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                  No immediate blocker detected on this order.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <TriangleAlert size={18} className="text-amber-600" />
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Blocked By</div>
              </div>
              {blockers.length ? (
                <div className="mt-4 space-y-3">
                  {blockers.map((blocker) => (
                    <div
                      key={blocker}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900"
                    >
                      {blocker}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                  Nothing is currently blocking this order from the data visible here.
                </div>
              )}
            </section>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm mb-8">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Order Summary</span>
            </div>

            <div className="px-6 pt-4 pb-5 grid gap-6 md:grid-cols-4 text-sm text-slate-800">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Order
                </h3>
                <p>
                  <span className="font-semibold">Model:</span> {summary.poolModel?.name || 'Not set'}
                </p>
                <p>
                  <span className="font-semibold">Color:</span> {summary.color?.name || 'Not set'}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">Status:</span>{' '}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                    {labelOrderStatus(summary.status)}
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Dealer
                </h3>
                <p className="font-semibold">{summary.dealer?.name || 'Not set'}</p>

                {summary.dealer?.email && (
                  <p className="text-xs">
                    <span className="font-semibold">Email:</span>{' '}
                    <a href={`mailto:${summary.dealer.email}`} className="text-sky-700 hover:underline">
                      {summary.dealer.email}
                    </a>
                  </p>
                )}

                {summary.dealer?.phone && (
                  <p className="text-xs">
                    <span className="font-semibold">Phone:</span> {summary.dealer.phone}
                  </p>
                )}

                {(summary.dealer?.address || summary.dealer?.city || summary.dealer?.state) && (
                  <p className="text-xs">
                    <span className="font-semibold">Dealer Address:</span>{' '}
                    {[summary.dealer?.address, summary.dealer?.city, summary.dealer?.state]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Schedule
                </h3>
                <p>
                  <span className="font-semibold">Requested Ship Date:</span> {requestedShipText}
                </p>
                <p>
                  <span className="font-semibold">ASAP:</span>{' '}
                  {summary.requestedShipAsap ? 'Yes' : 'No'}
                </p>
                <p>
                  <span className="font-semibold">Scheduled Ship Date:</span> {scheduledShipText}
                </p>
                <p>
                  <span className="font-semibold">Serial Number:</span>{' '}
                  {summary.serialNumber ? summary.serialNumber : <span className="italic text-slate-500">Not set</span>}
                </p>
                <p>
                  <span className="font-semibold">Production Priority:</span>{' '}
                  {typeof summary.productionPriority === 'number'
                    ? <>#{summary.productionPriority}</>
                    : <span className="italic text-slate-500">Not assigned</span>}
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Logistics
                </h3>
                <p>
                  <span className="font-semibold">Factory:</span>{' '}
                  {summary.factory?.name ? summary.factory.name : <span className="italic text-slate-500">Not assigned</span>}
                </p>
                <p>
                  <span className="font-semibold">Shipping:</span>{' '}
                  {summary.shippingMethod
                    ? (SHIPPING_LABELS[summary.shippingMethod] || summary.shippingMethod)
                    : <span className="italic text-slate-500">Not set</span>}
                </p>
                <p>
                  <span className="font-semibold">Invoice #:</span>{' '}
                  {displayInvoiceRef(summary.invoiceNumber, summary.id)}
                </p>

                <button
                  onClick={() => setEditing(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-100"
                >
                  <PencilLine size={16} />
                  Edit Order
                </button>
              </div>
            </div>

            <div className="px-6 pb-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Delivery Address
                </div>
                <div className="text-slate-800">{summary.deliveryAddress}</div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Order Notes
                </div>
                <div className="text-slate-800 whitespace-pre-wrap">
                  {summary.notes || <span className="italic text-slate-500">No notes</span>}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Hardware Request
                </div>
                <div className="space-y-2 text-slate-800">
                  <div>
                    <span className="font-semibold">Option:</span>{' '}
                    {labelPenetrationMode(summary.penetrationMode)}
                  </div>
                  <div>
                    <span className="font-semibold">Autocover:</span>{' '}
                    {summary.hardwareAutocover ? 'Requested' : 'Not requested'}
                  </div>
                  {summary.penetrationNotes ? (
                    <div>
                      <div className="font-semibold">Other Notes:</div>
                      <div className="mt-1 whitespace-pre-wrap text-slate-700">{summary.penetrationNotes}</div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Linked Job
                </div>
                {summary.job?.linkedOrders?.length ? (
                  <div className="space-y-2 text-slate-800">
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
                      Scheduling fields can be coordinated across the linked job. Status, serial number, files and history stay separate on each order.
                    </div>
                    <div>
                      <span className="font-semibold">Job role:</span>{' '}
                      {summary.job.itemType === 'SPA' ? 'Linked spa' : 'Primary pool'}
                    </div>
                    {summary.job.linkedOrders.map((linked) => (
                      <div key={linked.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="font-semibold text-slate-900">
                          {linked.poolModel?.name || 'Linked order'}
                          {linked.color?.name ? ` • ${linked.color.name}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {linked.itemType === 'SPA' ? 'Spa item' : 'Pool item'} • {labelOrderStatus(linked.status)}
                        </div>
                        <Link
                          href={`/admin/orders/${linked.id}/history`}
                          className="mt-2 inline-flex text-xs font-semibold text-sky-700 hover:underline"
                        >
                          Open linked order
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 italic">No linked job</div>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Stock Allocation
                </div>
                {allocation?.currentAllocation ? (
                  <div className="space-y-2 text-slate-800">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                      This order is currently tied to a finished stock unit. Releasing it will return the stock row to READY.
                    </div>
                    <div>
                      <span className="font-semibold">Stock Row:</span> {allocation.currentAllocation.id}
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span> {allocation.currentAllocation.status}
                    </div>
                    <div>
                      <span className="font-semibold">Serial:</span>{' '}
                      {allocation.currentAllocation.serialNumber || (
                        <span className="italic text-slate-500">No serial</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Production Date:</span>{' '}
                      {allocation.currentAllocation.productionDate
                        ? formatDateOnlyForDisplay(allocation.currentAllocation.productionDate)
                        : 'Not set'}
                    </div>
                    {allocation.currentAllocation.notes ? (
                      <div>
                        <span className="font-semibold">Notes:</span> {allocation.currentAllocation.notes}
                      </div>
                    ) : null}
                    <button
                      onClick={handleReleaseAllocation}
                      disabled={allocating}
                      className="mt-2 inline-flex rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {allocating ? 'Releasing…' : 'Release Allocation'}
                    </button>
                  </div>
                ) : allocation?.canAllocate ? (
                  <div className="space-y-3 text-slate-800">
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
                      Reserve a READY finished stock row that matches this order&apos;s factory, model, and color.
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        Available Stock
                      </label>
                      <select
                        value={selectedAllocationStockId}
                        onChange={(e) => setSelectedAllocationStockId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        disabled={allocating || availableAllocationCandidates.length === 0}
                      >
                        <option value="">
                          {availableAllocationCandidates.length === 0 ? 'No matching stock available' : 'Select stock row'}
                        </option>
                        {availableAllocationCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.serialNumber ? `${candidate.serialNumber} • ` : ''}
                            {candidate.productionDate
                              ? `${formatDateOnlyForDisplay(candidate.productionDate)} • `
                              : ''}
                            {candidate.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    {allocation.candidates.some((candidate) => candidate.allocatedToOtherOrder) ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Some matching stock rows are already allocated to other orders and are excluded here.
                      </div>
                    ) : null}
                    <button
                      onClick={handleAllocateStock}
                      disabled={allocating || !selectedAllocationStockId}
                      className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {allocating ? 'Allocating…' : 'Allocate Stock'}
                    </button>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    Finished stock can only be allocated while the order is in Needs Deposit, In Production, or Pre-Shipping.
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6">
              <ProductionBuildRecordCard
                orderId={orderId}
                currentSerialNumber={summary.serialNumber}
                onSaved={loadAll}
              />
            </div>

            <div className="px-6 pb-6">
              <BlueprintMarkersCard
                title="Dig Sheet Markers"
                subtitle={
                  summary.poolModel?.hasIntegratedSpa
                    ? 'Skimmer, Main Drains, and Returns included (white only). Standard fitting placement shown above—please indicate on schematic if alternate placement is necessary. Spa jet configuration follows the integrated spa schematic.'
                    : 'Skimmer, Main Drains, and Returns included (white only). Standard fitting placement shown above—please indicate on schematic if alternate placement is necessary. (Standard placement only on Main Drains)'
                }
                blueprintUrl={summary.poolModel?.blueprintUrl ?? null}
                markers={summary.blueprintMarkers ?? []}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {summary.status === 'PENDING_PAYMENT_APPROVAL' && (
              <button
                onClick={handleApprovePayment}
                disabled={saving}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
              >
                Approve Deposit Proof
              </button>
            )}

            <button
              onClick={() => setManualOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
            >
              Edit Status
            </button>

            {summary.paymentProofUrl && (
              <a
                href={summary.paymentProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                View Deposit Proof
              </a>
            )}

            <Link
              href={`/admin/orders/${orderId}/media`}
              className="inline-flex bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
            >
              Upload Media
            </Link>
          </div>
        </>
      )}

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3 text-slate-900">Timeline</h3>
        {history.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center text-sm text-slate-500">
            No history found.
          </div>
        ) : (
          <ul className="space-y-4">
            {history.map((h) => (
              <li
                key={h.id}
                className="border-l-4 border-sky-600 pl-4 py-3 bg-white rounded-r-xl shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {labelOrderStatus(h.status, { preserveLegacyApproved: true })}
                    </p>
                    {h.comment && <p className="text-sm text-slate-700 mt-1">{h.comment}</p>}
                    {h.user && <p className="text-xs text-slate-400 mt-1">By: {h.user.email}</p>}
                  </div>
                  <p className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3 text-slate-900">Uploaded Media</h3>
        {mediaFiles.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center text-sm text-slate-500">
            No media uploaded yet.
          </div>
        ) : (
          <div className="space-y-6">
            {photoMedia.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Photo Gallery</h4>
                    <p className="mt-1 text-xs text-slate-500">Keep order photos tucked away until you need visual reference.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {photoMedia.length} photos
                    </span>
                    <button
                      type="button"
                      onClick={() => setPhotoGalleryExpanded((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {photoGalleryExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {photoGalleryExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>
                {!photoGalleryExpanded ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                    Open the gallery to review or remove order photos without crowding the detail page.
                  </div>
                ) : <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {photoMedia.map((m) => (
                    <div key={m.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="block bg-slate-100">
                        <img
                          src={m.fileUrl}
                          alt={m.docType ? labelForDocType(m.docType) || labelDocType(m.docType) || m.docType : 'Photo'}
                          className="h-44 w-full object-cover"
                        />
                      </a>
                      <div className="space-y-2 px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {m.docType ? labelForDocType(m.docType) || labelDocType(m.docType) || m.docType : 'Photo'}
                        </div>
                        <div className="text-xs text-slate-500">Uploaded by: {formatUploader(m)}</div>
                        <div className="text-xs text-slate-500">{new Date(m.uploadedAt).toLocaleString()}</div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <a
                            href={m.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-sky-700 hover:underline"
                          >
                            Open
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(m.id)}
                            disabled={deletingMediaId === m.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            {deletingMediaId === m.id ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>}
              </div>
            ) : null}

            {documentMedia.length ? (
              <div className="grid gap-3">
                {documentMedia.map((m) => (
                  <div
                    key={m.id}
                    className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {m.docType ? labelForDocType(m.docType) || labelDocType(m.docType) || m.docType : m.type}
                      </p>
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-sky-700 hover:underline"
                      >
                        View File
                      </a>
                      <p className="text-xs text-slate-500 mt-1">
                        Uploaded by: {formatUploader(m)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-slate-500 whitespace-nowrap">{new Date(m.uploadedAt).toLocaleString()}</p>
                      <button
                        type="button"
                        onClick={() => handleDeleteMedia(m.id)}
                        disabled={deletingMediaId === m.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        {deletingMediaId === m.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {mounted && editing
        ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black mb-1 text-slate-900">Edit Order Inputs</h2>
            <p className="text-sm text-slate-600 mb-5">
              Update core order inputs after entry. Changes are saved and logged to order history.
            </p>

            <div className="space-y-6 mb-6">
              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 mb-3">
                  Order Details
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold mb-1 text-slate-700">
                      Delivery Address
                    </label>
                    <textarea
                      rows={3}
                      value={editDeliveryAddress}
                      onChange={(e) => setEditDeliveryAddress(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      disabled={saving}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold mb-1 text-slate-700">
                      Notes
                    </label>
                    <textarea
                      rows={4}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      disabled={saving}
                      placeholder="Optional notes for operations, shipping or production..."
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 mb-3">
                  Logistics
                </h3>
                {hasAllocatedStock ? (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This order has stock allocated. Release the stock allocation before changing the factory location.
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">
                      Factory Location
                    </label>
                    <select
                      value={selectedFactoryId}
                      onChange={(e) => setSelectedFactoryId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      disabled={saving || hasAllocatedStock}
                    >
                      <option value="">Not assigned</option>
                      {factoryList.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                          {f.city ? ` — ${f.city}${f.state ? `, ${f.state}` : ''}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">
                      Shipping Method
                    </label>
                    <select
                      value={selectedShippingMethod}
                      onChange={(e) => setSelectedShippingMethod(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      disabled={saving}
                    >
                      <option value="">Not set</option>
                      <option value="PICK_UP">Pick Up</option>
                      <option value="QUOTE">Glimmerglass Freight (quote to be provided)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">
                      Requested Ship Date
                    </label>
                    <input
                      type="date"
                      value={editRequestedDate}
                      onChange={(e) => setEditRequestedDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      disabled={saving}
                    />
                  </div>

                  <label className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    <input
                      type="checkbox"
                      checked={editRequestedShipAsap}
                      onChange={(e) => setEditRequestedShipAsap(e.target.checked)}
                      disabled={saving}
                    />
                    ASAP requested ship date
                  </label>

                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">
                      Invoice #
                    </label>
                    <input
                      type="text"
                      value={editInvoiceNumber}
                      onChange={(e) => setEditInvoiceNumber(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      disabled={saving}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 mb-3">
                  Production
                </h3>
                {hasAllocatedStock ? (
                  <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    Serial number is being driven by the allocated stock unit.
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">
                      Serial Number
                    </label>
                    <input
                      type="text"
                      value={editSerialNumber}
                      onChange={(e) => setEditSerialNumber(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      disabled={saving || hasAllocatedStock}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">
                      Production Priority
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      disabled={saving}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 mb-3">
                  Penetrations
                </h3>
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {([
                      {
                        value: 'NO_PENETRATIONS',
                        title: 'No penetrations (whitegoods ship loose)',
                        detail: '',
                      },
                      {
                        value: 'PENETRATIONS_WITHOUT_INSTALL',
                        title: 'Glimmerglass cuts penetrations (whitegoods ship loose)',
                        detail: '',
                      },
                      {
                        value: 'PENETRATIONS_WITH_INSTALL',
                        title: 'Glimmerglass installs hardware ($75 per return/main drain, skimmer ships loose)',
                        detail: '',
                      },
                      {
                        value: 'OTHER',
                        title: 'Other',
                        detail: 'Describe an alternate hardware request.',
                      },
                    ] as const).map((option) => {
                      const selected = editPenetrationMode === option.value
                      return (
                        <label
                          key={option.value}
                          className={[
                            'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition',
                            selected
                              ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100'
                              : 'border-slate-200 bg-white hover:border-slate-300',
                          ].join(' ')}
                        >
                          <input
                            type="radio"
                            name="editPenetrationMode"
                            checked={selected}
                            onChange={() => setEditPenetrationMode(option.value)}
                            className="mt-1"
                            disabled={saving}
                          />
                          <span className="block">
                            <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
                            <span className="block text-xs text-slate-600">{option.detail}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={editAutocover}
                        onChange={(e) => setEditAutocover(e.target.checked)}
                        disabled={saving}
                      />
                      Please check if an autocover is to be installed
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Autocovers are not provided/installed by Glimmerglass.
                    </p>
                  </div>

                  {editPenetrationMode === 'OTHER' ? (
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-slate-700">
                        Other Penetration Notes
                      </label>
                      <textarea
                        rows={3}
                        value={editPenetrationNotes}
                        onChange={(e) => setEditPenetrationNotes(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        disabled={saving}
                        placeholder="Describe the requested penetration setup..."
                      />
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 disabled:bg-sky-400"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
        : null}
    </div>
  )
}
