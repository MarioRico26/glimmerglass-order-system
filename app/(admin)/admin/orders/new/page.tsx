'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'

type Dealer = { id: string; name: string; email?: string | null }
type PoolModel = {
  id: string
  name: string
  productType?: 'POOL' | 'SPA'
  lengthFt?: number | null
  widthFt?: number | null
  depthFt?: number | null
  imageUrl?: string | null
  blueprintUrl?: string | null
  hasIntegratedSpa?: boolean
  maxSkimmers?: number | null
  maxReturns?: number | null
  maxMainDrains?: number | null
  defaultFactoryLocationId?: string | null
  defaultFactoryLocation?: { id: string; name: string } | null
}
type Color = { id: string; name: string; swatchUrl?: string | null }
type Factory = { id: string; name: string; city?: string | null; state?: string | null }
type PenetrationMode =
  | 'PENETRATIONS_WITH_INSTALL'
  | 'PENETRATIONS_WITHOUT_INSTALL'
  | 'NO_PENETRATIONS'
  | 'OTHER'

type BlueprintMarker = {
  type: 'skimmer' | 'return' | 'drain'
  x: number
  y: number
}

const STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
]

function makeTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  let out = ''
  for (let i = 0; i < 12; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function isPdf(url: string | null | undefined) {
  if (!url) return false
  return url.toLowerCase().split('?')[0].endsWith('.pdf')
}

function penetrationLabel(mode: '' | PenetrationMode) {
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
      return 'Select penetration option'
  }
}

export default function AdminNewOrderPage() {
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [models, setModels] = useState<PoolModel[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [factories, setFactories] = useState<Factory[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [dealerModalOpen, setDealerModalOpen] = useState(false)
  const [dealerModalBusy, setDealerModalBusy] = useState(false)
  const [dealerModalError, setDealerModalError] = useState('')
  const [modelSectionOpen, setModelSectionOpen] = useState(true)
  const [dealerForm, setDealerForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    createLogin: false,
    approved: true,
  })

  const [markerType, setMarkerType] = useState<'skimmer' | 'return' | 'drain'>('skimmer')
  const [markers, setMarkers] = useState<BlueprintMarker[]>([])
  const [markerError, setMarkerError] = useState('')
  const blueprintRef = useRef<HTMLDivElement | null>(null)

  const [form, setForm] = useState({
    dealerId: '',
    poolModelId: '',
    colorId: '',
    factoryLocationId: '',
    deliveryAddress: '',
    notes: '',
    shippingMethod: '' as '' | 'PICK_UP' | 'QUOTE',
    requestedShipDate: '',
    requestedShipAsap: false,
    invoiceNumber: '',
    penetrationMode: '' as '' | PenetrationMode,
    penetrationNotes: '',
    hardwareAutocover: false,
    linkSpaToJob: false,
    spaPoolModelId: '',
    spaColorId: '',
  })

  const activeModel = useMemo(
    () => models.find((m) => m.id === form.poolModelId) ?? null,
    [models, form.poolModelId]
  )
  const selectedColor = useMemo(
    () => colors.find((c) => c.id === form.colorId) ?? null,
    [colors, form.colorId]
  )
  const visibleModels = useMemo(() => {
    if (!form.factoryLocationId) return []
    return models.filter((m) => {
      const modelFactoryId = m.defaultFactoryLocationId || m.defaultFactoryLocation?.id || ''
      return modelFactoryId === form.factoryLocationId && (m.productType || 'POOL') === 'POOL'
    })
  }, [models, form.factoryLocationId])
  const visibleSpaModels = useMemo(() => {
    if (!form.factoryLocationId) return []
    return models.filter((m) => {
      const modelFactoryId = m.defaultFactoryLocationId || m.defaultFactoryLocation?.id || ''
      return modelFactoryId === form.factoryLocationId && m.productType === 'SPA'
    })
  }, [models, form.factoryLocationId])

  const ready = useMemo(() => {
    return !!(
      form.dealerId &&
      form.poolModelId &&
      form.colorId &&
      form.factoryLocationId &&
      form.deliveryAddress.trim()
    )
  }, [form])

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')

        const [dRes, mRes, cRes, fRes] = await Promise.allSettled([
          fetch('/api/admin/dealers/list', { cache: 'no-store' }),
          fetch('/api/catalog/pool-models', { cache: 'no-store' }),
          fetch('/api/catalog/colors', { cache: 'no-store' }),
          fetch('/api/catalog/factories', { cache: 'no-store' }),
        ])

        const [dJson, mJson, cJson, fJson] = await Promise.all([
          dRes.status === 'fulfilled' ? dRes.value.json().catch(() => null) : null,
          mRes.status === 'fulfilled' ? mRes.value.json().catch(() => null) : null,
          cRes.status === 'fulfilled' ? cRes.value.json().catch(() => null) : null,
          fRes.status === 'fulfilled' ? fRes.value.json().catch(() => null) : null,
        ])

        const nextDealers = Array.isArray(dJson?.items) ? dJson.items : []
        const nextModels = Array.isArray(mJson?.items) ? mJson.items : []
        const nextColors = Array.isArray(cJson?.items) ? cJson.items : []
        const nextFactories = Array.isArray(fJson?.items) ? fJson.items : []

        setDealers(nextDealers)
        setModels(nextModels)
        setColors(nextColors)
        setFactories(nextFactories)

        const failed: string[] = []
        if (dRes.status !== 'fulfilled' || !dRes.value.ok) failed.push('dealers')
        if (mRes.status !== 'fulfilled' || !mRes.value.ok) failed.push('pool models')
        if (cRes.status !== 'fulfilled' || !cRes.value.ok) failed.push('colors')
        if (fRes.status !== 'fulfilled' || !fRes.value.ok) failed.push('factories')
        if (failed.length > 0) {
          setError(`Some catalogs failed to load: ${failed.join(', ')}`)
        }

      } catch (e: unknown) {
        setError(toErrorMessage(e, 'Failed to load new-order data'))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    setMarkers([])
    setMarkerError('')
  }, [form.poolModelId])

  useEffect(() => {
    if (!form.factoryLocationId || !form.poolModelId) return
    const selectedModel = models.find((m) => m.id === form.poolModelId)
    if (!selectedModel) return
    if (selectedModel.defaultFactoryLocationId !== form.factoryLocationId) {
      setForm((prev) => ({ ...prev, poolModelId: '' }))
      setMarkers([])
      setMarkerError('')
    }
  }, [form.factoryLocationId, form.poolModelId, models])

  useEffect(() => {
    if (!form.factoryLocationId || !form.spaPoolModelId) return
    const selectedSpaModel = models.find((m) => m.id === form.spaPoolModelId)
    if (!selectedSpaModel) return
    const modelFactoryId =
      selectedSpaModel.defaultFactoryLocationId || selectedSpaModel.defaultFactoryLocation?.id || ''
    if (modelFactoryId !== form.factoryLocationId || selectedSpaModel.productType !== 'SPA') {
      setForm((prev) => ({ ...prev, spaPoolModelId: '', spaColorId: '' }))
    }
  }, [form.factoryLocationId, form.spaPoolModelId, models])

  useEffect(() => {
    if (!form.linkSpaToJob) {
      setForm((prev) => ({ ...prev, spaPoolModelId: '', spaColorId: '' }))
    }
  }, [form.linkSpaToJob])

  useEffect(() => {
    if (form.penetrationMode === 'NO_PENETRATIONS') {
      setMarkers([])
      setMarkerError('')
    }
  }, [form.penetrationMode])

  const handleBlueprintClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!form.penetrationMode || form.penetrationMode === 'NO_PENETRATIONS') return
    if (!activeModel?.blueprintUrl || isPdf(activeModel.blueprintUrl)) return
    if (!blueprintRef.current) return

    const rect = blueprintRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const clampedX = Math.min(100, Math.max(0, x))
    const clampedY = Math.min(100, Math.max(0, y))

    const limit = markerType === 'skimmer'
      ? activeModel?.maxSkimmers ?? null
      : markerType === 'return'
        ? activeModel?.maxReturns ?? null
        : activeModel?.maxMainDrains ?? null

    const currentCount = markers.filter((m) => m.type === markerType).length
    if (typeof limit === 'number' && limit >= 0 && currentCount >= limit) {
      setMarkerError(`Maximum ${markerType} markers reached for this model (${limit}).`)
      return
    }

    setMarkerError('')
    setMarkers((prev) => [
      ...prev,
      {
        type: markerType,
        x: Number(clampedX.toFixed(2)),
        y: Number(clampedY.toFixed(2)),
      },
    ])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    if (!form.penetrationMode) {
      setError('Please select a penetration option.')
      return
    }
    if (form.penetrationMode === 'OTHER' && !form.penetrationNotes.trim()) {
      setError('Please add notes when "Other" is selected.')
      return
    }
    if (form.linkSpaToJob && (!form.spaPoolModelId || !form.spaColorId)) {
      setError('Select spa model and spa color to link a spa to this job.')
      return
    }

    setSaving(true)
    setError('')
    setOkMsg('')
    try {
      const payload = {
        dealerId: form.dealerId,
        poolModelId: form.poolModelId,
        colorId: form.colorId,
        factoryLocationId: form.factoryLocationId,
        deliveryAddress: form.deliveryAddress.trim(),
        notes: form.notes.trim() || null,
        penetrationMode: form.penetrationMode,
        penetrationNotes: form.penetrationNotes.trim() || null,
        blueprintMarkers:
          form.penetrationMode === 'NO_PENETRATIONS'
            ? null
            : markers.length
              ? markers
              : null,
        shippingMethod: form.shippingMethod || null,
        requestedShipDate: form.requestedShipDate || null,
        requestedShipAsap: form.requestedShipAsap,
        invoiceNumber: form.invoiceNumber.trim() || null,
        hardwareAutocover: form.hardwareAutocover,
        linkedSpa:
          form.linkSpaToJob && form.spaPoolModelId && form.spaColorId
            ? {
                poolModelId: form.spaPoolModelId,
                colorId: form.spaColorId,
              }
            : null,
      }

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to create order')

      setOkMsg(`Order created successfully: ${json?.order?.id || 'new order'}`)
      setForm({
        dealerId: '',
        poolModelId: '',
        colorId: '',
        factoryLocationId: '',
        deliveryAddress: '',
        notes: '',
        shippingMethod: '',
        requestedShipDate: '',
        requestedShipAsap: false,
        invoiceNumber: '',
        penetrationMode: '',
        penetrationNotes: '',
        hardwareAutocover: false,
        linkSpaToJob: false,
        spaPoolModelId: '',
        spaColorId: '',
      })
      setMarkers([])
      setMarkerError('')
      setMarkerType('skimmer')
    } catch (e: unknown) {
      setError(toErrorMessage(e, 'Failed to create order'))
    } finally {
      setSaving(false)
    }
  }

  const openDealerModal = () => {
    setDealerModalError('')
    setDealerForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      createLogin: false,
      approved: true,
    })
    setDealerModalOpen(true)
  }

  const closeDealerModal = () => {
    if (dealerModalBusy) return
    setDealerModalOpen(false)
    setDealerModalError('')
  }

  const createDealerFromNewOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setDealerModalError('')
    try {
      setDealerModalBusy(true)
      const res = await fetch('/api/admin/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dealerForm,
          password: dealerForm.createLogin ? dealerForm.password : '',
          approved: dealerForm.createLogin ? dealerForm.approved : false,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to create dealer')

      const dealerId = String(json?.dealerId || '')
      const listRes = await fetch('/api/admin/dealers/list', { cache: 'no-store' })
      const listJson = await listRes.json().catch(() => null)
      if (listRes.ok && Array.isArray(listJson?.items)) {
        setDealers(listJson.items)
      } else {
        setDealers((prev) => {
          const temp = [...prev]
          if (dealerId && !temp.some((d) => d.id === dealerId)) {
            temp.push({ id: dealerId, name: dealerForm.name, email: dealerForm.email })
          }
          return temp
        })
      }

      if (dealerId) {
        setForm((prev) => ({ ...prev, dealerId }))
      }
      setDealerModalOpen(false)
      setOkMsg(`Dealer created and selected: ${dealerForm.name}`)
    } catch (err: unknown) {
      setDealerModalError(toErrorMessage(err, 'Failed to create dealer'))
    } finally {
      setDealerModalBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orders / New Order</div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">New Order</h1>
          <p className="text-slate-600">Create an order directly from Admin with optional dig sheet markers.</p>
        </div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to Order List
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {okMsg ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {okMsg}
        </div>
      ) : null}

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-5">
        {loading ? (
          <div className="py-10 text-center text-slate-500">Loading…</div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Order Basics</div>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Dealer
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={form.dealerId}
                      onChange={(e) => setForm((prev) => ({ ...prev, dealerId: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      required
                    >
                      <option value="">Select dealer</option>
                      {dealers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                          {d.email ? ` (${d.email})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={openDealerModal}
                      className="h-10 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      + New Dealer
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">If dealer does not exist yet, create and auto-select it.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Factory
                  </label>
                  <select
                    value={form.factoryLocationId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        factoryLocationId: e.target.value,
                        poolModelId: '',
                        spaPoolModelId: '',
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    required
                  >
                    <option value="">Select factory</option>
                    {factories.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.city ? ` — ${f.city}${f.state ? `, ${f.state}` : ''}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Pool Model
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setModelSectionOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {form.poolModelId
                            ? visibleModels.find((m) => m.id === form.poolModelId)?.name || 'Selected model'
                            : 'Select model'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {form.factoryLocationId
                            ? `${visibleModels.length} models available for the selected factory`
                            : 'Select a factory first to see matching models'}
                        </div>
                      </div>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                        {modelSectionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                    </button>

                    {modelSectionOpen ? (
                      <div className="border-t border-slate-200 bg-white px-3 py-3">
                        <select
                          value={form.poolModelId}
                          onChange={(e) => setForm((prev) => ({ ...prev, poolModelId: e.target.value }))}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                          required
                          disabled={!form.factoryLocationId}
                        >
                          <option value="">{form.factoryLocationId ? 'Select model' : 'Select factory first'}</option>
                          {visibleModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-slate-500">
                          {form.factoryLocationId
                            ? 'Only models assigned to the selected factory are shown.'
                            : 'Choose the production facility before selecting a pool model.'}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Color
                  </label>
                  <select
                    value={form.colorId}
                    onChange={(e) => setForm((prev) => ({ ...prev, colorId: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    required
                  >
                    <option value="">Select color</option>
                    {colors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {selectedColor ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                      {selectedColor.swatchUrl ? (
                        <img
                          src={selectedColor.swatchUrl}
                          alt={`${selectedColor.name} swatch`}
                          className="h-8 w-12 rounded object-cover border border-slate-200 bg-white"
                        />
                      ) : (
                        <span className="h-8 w-12 rounded bg-slate-200 border border-slate-200" />
                      )}
                      <div className="text-xs">
                        <div className="font-semibold text-slate-900">Selected color</div>
                        <div className="text-slate-600">{selectedColor.name}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Linked Job</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">Build pool and spa under the same job</div>
                    <div className="text-xs text-slate-500">
                      Use this when the spa should be scheduled with the pool for production and shipping.
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.linkSpaToJob}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          linkSpaToJob: e.target.checked,
                          ...(e.target.checked ? {} : { spaPoolModelId: '', spaColorId: '' }),
                        }))
                      }
                    />
                    Link spa
                  </label>
                </div>

                {form.linkSpaToJob ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Spa Model
                      </label>
                      <select
                        value={form.spaPoolModelId}
                        onChange={(e) => setForm((prev) => ({ ...prev, spaPoolModelId: e.target.value }))}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                        disabled={!form.factoryLocationId}
                      >
                        <option value="">{form.factoryLocationId ? 'Select spa model' : 'Select factory first'}</option>
                        {visibleSpaModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Spa Color
                      </label>
                      <select
                        value={form.spaColorId}
                        onChange={(e) => setForm((prev) => ({ ...prev, spaColorId: e.target.value }))}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="">Select spa color</option>
                        {colors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Shipping Method
                  </label>
                  <select
                    value={form.shippingMethod}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        shippingMethod: e.target.value as '' | 'PICK_UP' | 'QUOTE',
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Not set</option>
                    <option value="PICK_UP">Pick Up</option>
                    <option value="QUOTE">Glimmerglass Freight (quote to be provided)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Requested Ship Date
                  </label>
                  <input
                    type="date"
                    value={form.requestedShipDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, requestedShipDate: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Invoice #
                  </label>
                  <input
                    type="text"
                    value={form.invoiceNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                    placeholder="Optional invoice number"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={form.requestedShipAsap}
                  onChange={(e) => setForm((prev) => ({ ...prev, requestedShipAsap: e.target.checked }))}
                />
                ASAP requested ship date
              </label>
            </section>

            <section className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Hardware & Penetrations</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hardware (please check one)
                </div>

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
                    const selected = form.penetrationMode === option.value
                    return (
                      <label
                        key={option.value}
                        className={[
                          'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition',
                          selected
                            ? 'border-sky-300 bg-white shadow-sm ring-2 ring-sky-100'
                            : 'border-slate-200 bg-white hover:border-slate-300',
                        ].join(' ')}
                      >
                        <input
                          type="radio"
                          name="penetrationMode"
                          className="mt-1"
                          checked={selected}
                          onChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              penetrationMode: option.value,
                            }))
                          }
                        />
                        <span className="block">
                          <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
                          <span className="block text-xs text-slate-600">{option.detail}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.hardwareAutocover}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, hardwareAutocover: e.target.checked }))
                      }
                    />
                    Please check if an autocover is to be installed
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Autocovers are not provided/installed by Glimmerglass.
                  </p>
                </div>

                {form.penetrationMode === 'OTHER' ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Other Penetration Notes
                    </label>
                    <textarea
                      value={form.penetrationNotes}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, penetrationNotes: e.target.value }))
                      }
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      placeholder="Describe the requested penetration setup."
                    />
                  </div>
                ) : null}

                {form.penetrationMode ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    Selected hardware request: <span className="font-semibold">{penetrationLabel(form.penetrationMode)}</span>
                  </div>
                ) : null}
              </div>

              {!form.penetrationMode ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Select a penetration option to enable marker placement.
                </div>
              ) : form.penetrationMode === 'NO_PENETRATIONS' ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Schematic markup is disabled when <span className="font-semibold">No penetrations</span> is selected.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Dig Sheet Marker Placement</div>
                      <p className="text-xs text-slate-600">
                        {activeModel?.hasIntegratedSpa
                          ? 'Skimmer, Main Drains, and Returns included (white only). Standard fitting placement shown above—please indicate on schematic if alternate placement is necessary. Spa jet configuration follows the integrated spa schematic.'
                          : 'Skimmer, Main Drains, and Returns included (white only). Standard fitting placement shown above—please indicate on schematic if alternate placement is necessary. (Standard placement only on Main Drains)'}
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setMarkerType('skimmer')}
                        className={[
                          'h-8 rounded-md px-3 text-xs font-semibold',
                          markerType === 'skimmer' ? 'bg-sky-600 text-white' : 'text-slate-700 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        Skimmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarkerType('return')}
                        className={[
                          'h-8 rounded-md px-3 text-xs font-semibold',
                          markerType === 'return' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        Return
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarkerType('drain')}
                        className={[
                          'h-8 rounded-md px-3 text-xs font-semibold',
                          markerType === 'drain' ? 'bg-rose-600 text-white' : 'text-slate-700 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        Main Drain
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">
                    Skimmers limit: <span className="font-semibold">{activeModel?.maxSkimmers ?? 'no limit'}</span>
                    {' · '}
                    Returns limit: <span className="font-semibold">{activeModel?.maxReturns ?? 'no limit'}</span>
                    {' · '}
                    Main Drains limit: <span className="font-semibold">{activeModel?.maxMainDrains ?? 'no limit'}</span>
                  </div>

                  {!activeModel ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                      Select a pool model to place markers.
                    </div>
                  ) : !activeModel.blueprintUrl ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                      This model has no dig sheet uploaded yet.
                    </div>
                  ) : isPdf(activeModel.blueprintUrl) ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-4 text-sm text-slate-700">
                      This dig sheet is a PDF.
                      {' '}
                      <a
                        href={activeModel.blueprintUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sky-700 hover:underline"
                      >
                        Open dig sheet
                      </a>
                    </div>
                  ) : (
                    <div
                      ref={blueprintRef}
                      onClick={handleBlueprintClick}
                      className="relative overflow-hidden rounded-lg border border-slate-200 bg-white cursor-crosshair"
                    >
                      <img
                        src={activeModel.blueprintUrl}
                        alt={`${activeModel.name} dig sheet`}
                        className="block w-full max-h-[480px] object-contain bg-slate-100"
                      />
                      {markers.map((m, idx) => (
                        <div
                          key={`${m.type}-${idx}`}
                          className={[
                            'absolute -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 shadow',
                            m.type === 'skimmer'
                              ? 'bg-sky-600 border-sky-900'
                              : m.type === 'return'
                                ? 'bg-emerald-600 border-emerald-900'
                                : 'bg-amber-600 border-amber-900',
                          ].join(' ')}
                          style={{ left: `${m.x}%`, top: `${m.y}%` }}
                          title={`${m.type} (${m.x}%, ${m.y}%)`}
                        />
                      ))}
                    </div>
                  )}

                  {markerError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {markerError}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {markers.map((m, idx) => (
                      <button
                        key={`${m.type}-${idx}-chip`}
                        type="button"
                        onClick={() => setMarkers((prev) => prev.filter((_, i) => i !== idx))}
                        className={[
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                          m.type === 'skimmer'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : m.type === 'return'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200',
                        ].join(' ')}
                        title="Remove marker"
                      >
                        {m.type} ({m.x}%, {m.y}%)
                      </button>
                    ))}
                  </div>

                  {markers.length > 0 ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setMarkers([])}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Clear markers
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Address & Notes</div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Delivery Address
                </label>
                <textarea
                  value={form.deliveryAddress}
                  onChange={(e) => setForm((prev) => ({ ...prev, deliveryAddress: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Street, city, state, ZIP"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Notes (optional)
                </label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  placeholder="Internal notes"
                />
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !ready}
                className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create New Order'}
              </button>
            </div>
          </>
        )}
      </form>

      {dealerModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Create Dealer</h2>
                <p className="text-sm text-slate-600">Create dealer and use it immediately on this order.</p>
              </div>
              <button
                type="button"
                onClick={closeDealerModal}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={createDealerFromNewOrder} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={dealerForm.name}
                onChange={(e) => setDealerForm((prev) => ({ ...prev, name: e.target.value }))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                placeholder="Dealer name"
                required
              />
              <input
                type="email"
                value={dealerForm.email}
                onChange={(e) => setDealerForm((prev) => ({ ...prev, email: e.target.value }))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                placeholder="Email"
                required
              />
              <div className="md:col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={dealerForm.password}
                  onChange={(e) => setDealerForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  placeholder={dealerForm.createLogin ? 'Temporary password (min 6)' : 'No login will be created'}
                  required={dealerForm.createLogin}
                  disabled={!dealerForm.createLogin}
                />
                <button
                  type="button"
                  onClick={() => setDealerForm((prev) => ({ ...prev, password: makeTemporaryPassword(), createLogin: true }))}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  disabled={!dealerForm.createLogin}
                >
                  Generate
                </button>
              </div>
              <input
                value={dealerForm.phone}
                onChange={(e) => setDealerForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                placeholder="Phone"
                required
              />
              <input
                value={dealerForm.city}
                onChange={(e) => setDealerForm((prev) => ({ ...prev, city: e.target.value }))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                placeholder="City"
                required
              />
              <input
                value={dealerForm.address}
                onChange={(e) => setDealerForm((prev) => ({ ...prev, address: e.target.value }))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm md:col-span-2"
                placeholder="Address"
                required
              />
              <select
                value={dealerForm.state}
                onChange={(e) => setDealerForm((prev) => ({ ...prev, state: e.target.value }))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                required
              >
                <option value="">State</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={dealerForm.createLogin}
                  onChange={(e) =>
                    setDealerForm((prev) => ({
                      ...prev,
                      createLogin: e.target.checked,
                      password: e.target.checked ? (prev.password || makeTemporaryPassword()) : '',
                      approved: e.target.checked ? prev.approved : false,
                    }))
                  }
                />
                Create login now
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={dealerForm.approved}
                  onChange={(e) => setDealerForm((prev) => ({ ...prev, approved: e.target.checked }))}
                  disabled={!dealerForm.createLogin}
                />
                Approved for login
              </label>

              {dealerModalError ? (
                <div className="md:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {dealerModalError}
                </div>
              ) : null}

              <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeDealerModal}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dealerModalBusy}
                  className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {dealerModalBusy ? 'Creating…' : 'Create Dealer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
