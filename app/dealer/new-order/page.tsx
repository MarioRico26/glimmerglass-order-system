'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Palette,
  Truck,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarDays,
  Settings2,
} from 'lucide-react'
import WireInstructions from '@/components/WireInstructions'
import ShippingNotice from '@/components/ShippingNotice'

type PoolModel = {
  id: string
  name: string
  lengthFt: number | null
  widthFt: number | null
  depthFt: number | null
  imageUrl?: string | null
  blueprintUrl?: string | null
  defaultFactoryLocationId?: string | null
  defaultFactoryLocation?: { id: string; name: string } | null
}

type Color = {
  id: string
  name: string
  swatchUrl?: string | null
}

type BlueprintMarker = { type: 'skimmer' | 'return' | 'drain'; x: number; y: number }
type ReadyStockSummary = { poolModel: { id: string } | null; quantity: number }

const aqua = '#00B2CA'
const deep = '#007A99'

export default function NewOrderPage() {
  // form
  const [dealerId, setDealerId] = useState('')
  const [poolModelId, setPoolModelId] = useState('')
  const [colorId, setColorId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentProof, setPaymentProof] = useState<File | null>(null)

  // nuevos campos
  const [shippingMethod, setShippingMethod] = useState<'PICK_UP' | 'QUOTE' | ''>('')
  const [requestedShipDate, setRequestedShipDate] = useState('')

  // hardware
  const [hardwareSkimmer, setHardwareSkimmer] = useState(false)
  const [hardwareReturns, setHardwareReturns] = useState(false)
  const [hardwareMainDrains, setHardwareMainDrains] = useState(false)
  const [hardwareAutocover, setHardwareAutocover] = useState<boolean | null>(null)

  // data
  const [models, setModels] = useState<PoolModel[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [modelSearch, setModelSearch] = useState('')
  const [onlyReadyModels, setOnlyReadyModels] = useState(false)
  const [markerType, setMarkerType] = useState<BlueprintMarker['type']>('skimmer')
  const [markers, setMarkers] = useState<BlueprintMarker[]>([])
  const blueprintRef = useRef<HTMLDivElement | null>(null)
  const [readyStockRows, setReadyStockRows] = useState<ReadyStockSummary[]>([])
  const [inStock, setInStock] = useState<
    {
      id: string
      factory: { id?: string; name: string }
      quantity: number
      eta: string | null
      status: 'READY'
    }[]
  >([])
  const [selectedStockId, setSelectedStockId] = useState('')
  const [prefillStockId, setPrefillStockId] = useState('')
  const [prefillApplied, setPrefillApplied] = useState(false)
  const [prefillQuery, setPrefillQuery] = useState({
    poolModelId: '',
    colorId: '',
    poolStockId: '',
  })
  const [stockLoading, setStockLoading] = useState(false)

  // ui
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const activeModel = useMemo(
    () => models.find((m) => m.id === poolModelId) ?? null,
    [models, poolModelId]
  )

  const readyQtyByModel = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of readyStockRows) {
      const modelId = row.poolModel?.id
      if (!modelId) continue
      map.set(modelId, (map.get(modelId) || 0) + (row.quantity || 0))
    }
    return map
  }, [readyStockRows])

  const visibleModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase()
    const searched = !q ? models : models.filter((m) => m.name.toLowerCase().includes(q))
    if (!onlyReadyModels) return searched
    return searched.filter((m) => (readyQtyByModel.get(m.id) || 0) > 0)
  }, [models, modelSearch, onlyReadyModels, readyQtyByModel])

  const blueprintIsPdf = useMemo(() => {
    const url = activeModel?.blueprintUrl || ''
    return url.toLowerCase().includes('.pdf')
  }, [activeModel?.blueprintUrl])

  // fecha mínima: hoy + 28 días
  const minRequestedDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 28)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setPrefillQuery({
      poolModelId: params.get('poolModelId') || '',
      colorId: params.get('colorId') || '',
      poolStockId: params.get('poolStockId') || '',
    })
  }, [])

  // fetch initial
  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setMsg(null)

        // dealer actual
        const dealerRes = await fetch('/api/dealer/me', { cache: 'no-store' })
        const dealerJson = await dealerRes.json()
        if (dealerRes.ok && dealerJson?.dealerId) {
          setDealerId(dealerJson.dealerId)
        } else {
          setMsg({
            type: 'err',
            text: 'Could not detect dealer account. Please sign in again.',
          })
        }

        const [mRes, cRes, sRes] = await Promise.all([
          fetch('/api/catalog/pool-models'),
          fetch('/api/catalog/colors'),
          fetch('/api/dealer/in-stock', { cache: 'no-store' }),
        ])

        const [mJson, cJson, sJson] = await Promise.all([
          mRes.json(),
          cRes.json(),
          sRes.json().catch(() => null),
        ])

        if (!mRes.ok) throw new Error(mJson?.message || 'Error loading pool models')
        if (!cRes.ok) throw new Error(cJson?.message || 'Error loading colors')

        setModels(mJson.items || [])
        setColors(cJson.items || [])
        setReadyStockRows(Array.isArray(sJson?.items) ? sJson.items : [])
      } catch (e: unknown) {
        setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Error fetching data' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (loading || prefillApplied) return

    if (prefillQuery.poolModelId && models.some((m) => m.id === prefillQuery.poolModelId)) {
      setPoolModelId(prefillQuery.poolModelId)
    }
    if (prefillQuery.colorId && colors.some((c) => c.id === prefillQuery.colorId)) {
      setColorId(prefillQuery.colorId)
    }
    if (prefillQuery.poolStockId) {
      setPrefillStockId(prefillQuery.poolStockId)
    }

    setPrefillApplied(true)
  }, [
    loading,
    prefillApplied,
    prefillQuery,
    models,
    colors,
  ])

  useEffect(() => {
    let abort = false

    if (!poolModelId || !colorId) {
      setInStock([])
      return
    }

    ;(async () => {
      try {
        setStockLoading(true)
        const params = new URLSearchParams({
          poolModelId,
          colorId,
        })
        const res = await fetch(`/api/dealer/in-stock?${params.toString()}`, {
          cache: 'no-store',
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.message || 'Failed to load stock')

        if (!abort) {
          setInStock(
            Array.isArray(json?.items)
              ? json.items.map((row: {
                  id: string
                  factory: { id?: string; name: string }
                  quantity: number
                  eta: string | null
                  status: 'READY'
                }) => ({
                  id: row.id,
                  factory: row.factory,
                  quantity: row.quantity,
                  eta: row.eta ?? null,
                  status: row.status,
                }))
              : []
          )
        }
      } catch {
        if (!abort) setInStock([])
      } finally {
        if (!abort) setStockLoading(false)
      }
    })()

    return () => {
      abort = true
    }
  }, [poolModelId, colorId])

  useEffect(() => {
    setMarkers([])
  }, [poolModelId])

  useEffect(() => {
    setSelectedStockId('')
  }, [poolModelId, colorId])

  useEffect(() => {
    if (!selectedStockId) return
    const exists = inStock.some((row) => row.id === selectedStockId)
    if (!exists) setSelectedStockId('')
  }, [inStock, selectedStockId])

  useEffect(() => {
    if (!prefillStockId) return
    if (inStock.some((row) => row.id === prefillStockId)) {
      setSelectedStockId(prefillStockId)
      setPrefillStockId('')
    }
  }, [inStock, prefillStockId])

  const handleBlueprintClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!blueprintRef.current) return
    const rect = blueprintRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const clampedX = Math.min(100, Math.max(0, x))
    const clampedY = Math.min(100, Math.max(0, y))

    setMarkers((prev) => [
      ...prev,
      {
        type: markerType,
        x: Number(clampedX.toFixed(2)),
        y: Number(clampedY.toFixed(2)),
      },
    ])
  }

  const removeMarker = (index: number) => {
    setMarkers((prev) => prev.filter((_, i) => i !== index))
  }

  function validateRequestedDate(value: string): string | null {
    if (!value) return 'Please select a requested ship date.'
    const chosen = new Date(value)
    const min = new Date(minRequestedDate)
    if (isNaN(chosen.getTime())) return 'Invalid requested ship date.'
    if (chosen < min) {
      return 'Requested ship date must be at least 4 weeks in the future.'
    }
    return null
  }

  function labelEta(value: string | null) {
    if (!value) return 'No ETA'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return 'No ETA'
    return `ETA: ${d.toLocaleDateString()}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    if (!dealerId) {
      setMsg({
        type: 'err',
        text: 'Dealer not detected. Please sign in again.',
      })
      return
    }

    if (!poolModelId || !colorId || !deliveryAddress) {
      setMsg({
        type: 'err',
        text: 'Please complete all required fields.',
      })
      return
    }

    if (!paymentProof) {
      setMsg({
        type: 'err',
        text: 'Please attach the payment proof.',
      })
      return
    }

    if (!shippingMethod) {
      setMsg({
        type: 'err',
        text: 'Please select a shipping method.',
      })
      return
    }

    const dateError = validateRequestedDate(requestedShipDate)
    if (dateError) {
      setMsg({ type: 'err', text: dateError })
      return
    }

    if (hardwareAutocover === null) {
      setMsg({
        type: 'err',
        text: 'Please answer whether an autocover is required (Yes / No).',
      })
      return
    }

    try {
      setSubmitting(true)

      const formData = new FormData()
      formData.append('dealerId', dealerId)
      formData.append('poolModelId', poolModelId)
      formData.append('colorId', colorId)
      formData.append('deliveryAddress', deliveryAddress)
      formData.append('notes', notes)
      formData.append('paymentProof', paymentProof)
      formData.append('shippingMethod', shippingMethod)

      // nuevo campo (como string ISO de date sin hora)
      formData.append('requestedShipDate', requestedShipDate)

      // hardware flags
      formData.append('hardwareSkimmer', String(hardwareSkimmer))
      formData.append('hardwareReturns', String(hardwareReturns))
      formData.append('hardwareMainDrains', String(hardwareMainDrains))
      formData.append('hardwareAutocover', String(hardwareAutocover))

      if (markers.length) {
        formData.append('blueprintMarkers', JSON.stringify(markers))
      }

      if (selectedStockId) {
        formData.append('poolStockId', selectedStockId)
      }

      // Importante: ya no mandamos factoryLocationId desde el dealer
      // el admin la asigna después en el panel de administración

      const res = await fetch('/api/orders', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.message || 'Order creation failed')
      }

      setMsg({ type: 'ok', text: 'Order created successfully.' })

      // reset parcial
      setPoolModelId('')
      setColorId('')
      setDeliveryAddress('')
      setNotes('')
      setPaymentProof(null)
      setShippingMethod('')
      setRequestedShipDate('')
      setHardwareSkimmer(false)
      setHardwareReturns(false)
      setHardwareMainDrains(false)
      setHardwareAutocover(null)
      setMarkers([])
      setMarkerType('skimmer')
      setSelectedStockId('')
    } catch (e: unknown) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : 'Network error during order creation.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6">
          <div className="h-6 w-40 rounded bg-slate-100 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-12 w-full rounded bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            New Order
          </h1>
          <p className="text-slate-600">
            Create a new pool order with model, color, requested ship date and
            delivery details.
          </p>
        </div>

        {msg && (
          <div
            className={[
              'mb-4 rounded-xl px-4 py-3 text-sm flex items-start gap-2',
              msg.type === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-rose-50 text-rose-700 border border-rose-100',
            ].join(' ')}
          >
            {msg.type === 'ok' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {msg?.type === 'ok' ? (
          <div className="mb-6 space-y-3">
            <ShippingNotice />
            <div>
              <a
                href="/dealer/wire-instructions"
                className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                View Wire Instructions
              </a>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pool Model */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pool Model
            </label>

            <div className="flex flex-col gap-3">
              <input
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Search model…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={onlyReadyModels}
                    onChange={(e) => setOnlyReadyModels(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Show available pools only (READY stock)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    {visibleModels.length} models shown
                  </span>
                  <a
                    href="/dealer/in-stock"
                    className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    View In-Stock List
                  </a>
                </div>
              </div>

              {visibleModels.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  No pool models match the current filters.
                </div>
              ) : null}

              <div className="max-h-[36rem] overflow-auto pr-1">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleModels.map((m) => {
                    const readyQty = readyQtyByModel.get(m.id) || 0
                    const selected = poolModelId === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPoolModelId(m.id)}
                        className={[
                          'text-left rounded-2xl border bg-white overflow-hidden shadow-sm transition',
                          selected
                            ? 'border-sky-300 ring-2 ring-sky-200'
                            : 'border-slate-200 hover:border-slate-300',
                        ].join(' ')}
                      >
                        <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                          {m.imageUrl ? (
                            <img
                              src={m.imageUrl}
                              alt={m.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold text-slate-900">{m.name}</div>
                            {readyQty > 0 ? (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                In stock: {readyQty}
                              </span>
                            ) : selected ? (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                Selected
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                Build to order
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-slate-600 flex flex-wrap gap-2">
                            <span>L: {m.lengthFt ?? '-'} ft</span>
                            <span>W: {m.widthFt ?? '-'} ft</span>
                            <span>D: {m.depthFt ?? '-'} ft</span>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Factory: {m.defaultFactoryLocation?.name || 'Assigned by admin'}
                          </div>
                          <div className="mt-2 text-xs">
                            {m.blueprintUrl ? (
                              <a
                                href={m.blueprintUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-700 underline"
                              >
                                View blueprint
                              </a>
                            ) : (
                              <span className="text-slate-400">No blueprint</span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pool Color
            </label>
            <div className="relative">
              <select
                value={colorId}
                onChange={(e) => setColorId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                required
              >
                <option value="">Select pool color</option>
                {colors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Palette
                className="pointer-events-none absolute right-3 top-2.5 text-slate-400"
                size={18}
              />
            </div>

            {/* Swatches */}
            <div className="mt-3 flex flex-wrap gap-3">
              {colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColorId(c.id)}
                  className={[
                    'inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm',
                    colorId === c.id
                      ? 'border-sky-300 ring-2 ring-sky-200 bg-sky-50'
                      : 'border-slate-200 hover:bg-slate-50',
                  ].join(' ')}
                  title={c.name}
                >
                  {c.swatchUrl ? (
                    <img
                      src={c.swatchUrl}
                      alt={c.name}
                      className="h-4 w-6 rounded object-cover"
                    />
                  ) : (
                    <span className="h-4 w-6 rounded bg-slate-200 block" />
                  )}
                  <span className="text-slate-700">{c.name}</span>
                </button>
              ))}
            </div>

            {/* In-stock hint */}
            {poolModelId && colorId ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                <div className="text-sm font-semibold flex items-center gap-2">
                  ✅ IN STOCK — READY TO SHIP
                </div>
                {stockLoading ? (
                  <div className="text-sm text-emerald-700 mt-1">Checking availability…</div>
                ) : inStock.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 text-sm text-emerald-900">
                      <input
                        type="radio"
                        name="stockSelection"
                        checked={!selectedStockId}
                        onChange={() => setSelectedStockId('')}
                        className="mt-1"
                      />
                      <span>
                        Continue with regular production flow (no stock reservation now)
                      </span>
                    </label>
                    {inStock.map((row) => (
                      <label
                        key={row.id}
                        className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 text-sm text-emerald-900"
                      >
                        <input
                          type="radio"
                          name="stockSelection"
                          checked={selectedStockId === row.id}
                          onChange={() => setSelectedStockId(row.id)}
                          className="mt-1"
                        />
                        <span>
                          ✅ Available now at {row.factory?.name || 'Factory'} ({row.quantity} units) • {labelEta(row.eta)}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-emerald-700 mt-1">
                    No ready stock available right now.
                  </div>
                )}
                {selectedStockId ? (
                  <div className="mt-2 text-xs text-emerald-900 font-semibold">
                    Selected stock will be reserved immediately when the order is created.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Blueprint markup */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Blueprint Markup (optional)
            </label>

            {!activeModel?.blueprintUrl ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No blueprint uploaded for this model yet.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Marker type:</span>
                  <button
                    type="button"
                    onClick={() => setMarkerType('skimmer')}
                    className={[
                      'px-3 py-1 rounded-full text-xs font-semibold border',
                      markerType === 'skimmer'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-white text-slate-700 border-slate-200',
                    ].join(' ')}
                  >
                    Skimmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkerType('return')}
                    className={[
                      'px-3 py-1 rounded-full text-xs font-semibold border',
                      markerType === 'return'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-700 border-slate-200',
                    ].join(' ')}
                  >
                    Return
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkerType('drain')}
                    className={[
                      'px-3 py-1 rounded-full text-xs font-semibold border',
                      markerType === 'drain'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-white text-slate-700 border-slate-200',
                    ].join(' ')}
                  >
                    Main Drain
                  </button>
                  {markers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMarkers([])}
                      className="px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 text-slate-600"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div
                  ref={blueprintRef}
                  className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  {blueprintIsPdf ? (
                    <object
                      data={activeModel.blueprintUrl}
                      type="application/pdf"
                      className="w-full h-[420px] pointer-events-none"
                    />
                  ) : (
                    <img
                      src={activeModel.blueprintUrl}
                      alt={`${activeModel.name} blueprint`}
                      className="w-full h-[420px] object-contain bg-white pointer-events-none"
                    />
                  )}

                  <div
                    className="absolute inset-0"
                    onClick={handleBlueprintClick}
                    role="button"
                    aria-label="Add marker"
                  />

                  <div className="absolute inset-0 pointer-events-none">
                    {markers.map((m, idx) => (
                      <div
                        key={`${m.type}-${idx}`}
                        className={[
                          'absolute flex items-center justify-center rounded-full text-[10px] font-bold shadow',
                          m.type === 'skimmer'
                            ? 'bg-sky-600 text-white'
                            : m.type === 'return'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white',
                        ].join(' ')}
                        style={{
                          left: `${m.x}%`,
                          top: `${m.y}%`,
                          width: '22px',
                          height: '22px',
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        {m.type === 'skimmer' ? 'S' : m.type === 'return' ? 'R' : 'D'}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Click on the blueprint to place markers. You can remove markers below before submitting.
                </div>

                {markers.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600 mb-2">
                      Markers ({markers.length})
                    </div>
                    <div className="space-y-1 text-xs text-slate-700">
                      {markers.map((m, idx) => (
                        <div key={`${m.type}-row-${idx}`} className="flex items-center justify-between">
                          <div>
                            {m.type} • x:{m.x}% y:{m.y}%
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMarker(idx)}
                            className="text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shipping Method + Requested Ship Date */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Shipping Method
              </label>
              <div className="relative">
                <select
                  value={shippingMethod}
                  onChange={(e) =>
                    setShippingMethod(e.target.value as 'PICK_UP' | 'QUOTE' | '')
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  required
                >
                  <option value="">Select shipping method</option>
                  <option value="PICK_UP">Pick Up at Factory</option>
                  <option value="QUOTE">Request Shipping Quote</option>
                </select>
                <Settings2
                  className="pointer-events-none absolute right-3 top-2.5 text-slate-400"
                  size={18}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Requested Ship Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={requestedShipDate}
                  min={minRequestedDate}
                  onChange={(e) => setRequestedShipDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  required
                />
                <CalendarDays
                  className="pointer-events-none absolute right-3 top-2.5 text-slate-400"
                  size={18}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Must be at least 4 weeks from today.
              </p>
            </div>
          </div>

          <ShippingNotice />

          {/* Delivery Address */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Delivery Address
            </label>
            <div className="relative">
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Street address, city, state, ZIP, and any access notes (gate codes, tight streets, etc.)"
                required
              />
              <Truck
                className="pointer-events-none absolute right-3 top-2.5 text-slate-300"
                size={18}
              />
            </div>
          </div>

          {/* Hardware selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hardware Included
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hardwareSkimmer}
                  onChange={(e) => setHardwareSkimmer(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                />
                <span>Skimmer</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hardwareReturns}
                  onChange={(e) => setHardwareReturns(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                />
                <span>Returns</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hardwareMainDrains}
                  onChange={(e) => setHardwareMainDrains(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                />
                <span>Main Drains</span>
              </label>
            </div>

            {/* Autocover en otra línea con Yes / No */}
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">
                Autocover Required?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setHardwareAutocover(true)}
                  className={[
                    'flex-1 inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium',
                    hardwareAutocover === true
                      ? 'border-sky-400 bg-sky-50 text-sky-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setHardwareAutocover(false)}
                  className={[
                    'flex-1 inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium',
                    hardwareAutocover === false
                      ? 'border-slate-400 bg-slate-50 text-slate-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  No
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                This helps production plan hardware and lead times correctly.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Additional Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="Any special instructions, site constraints, or comments for Glimmerglass…"
            />
          </div>

          {/* Payment proof */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Payment Proof (image or PDF)
            </label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50">
                <Paperclip size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-800">
                  {paymentProof ? paymentProof.name : 'Choose file'}
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) =>
                    setPaymentProof(e.target.files?.[0] || null)
                  }
                  className="hidden"
                  required
                />
              </label>
              {paymentProof && (
                <span className="text-xs text-slate-500">
                  {(paymentProof.size / 1024 / 1024).toFixed(2)} MB
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Only certified checks or bank transfers are accepted. Your payment
              will be reviewed by our accounting department before production
              begins.
            </p>
          </div>

          {/* Wire instructions */}
          <WireInstructions compact />

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center w-full h-11 rounded-xl text-white font-semibold shadow-lg transition-transform active:scale-[0.99] disabled:opacity-70"
              style={{ backgroundImage: 'linear-gradient(90deg,#00B2CA,#007A99)' }}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Creating order…
                </>
              ) : (
                'Submit Order'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* gradient underline */}
      <div
        className="mt-6 h-1 w-full rounded-full"
        style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
      />
    </div>
  )
}
