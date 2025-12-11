'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Palette,
  Truck,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ruler,
  CalendarDays,
  Settings2,
} from 'lucide-react'

type PoolModel = {
  id: string
  name: string
  lengthFt: number | null
  widthFt: number | null
  depthFt: number | null
}

type Color = {
  id: string
  name: string
  swatchUrl?: string | null
}

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

  // ui
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const selectedModel = useMemo(
    () => models.find((m) => m.id === poolModelId) ?? null,
    [models, poolModelId]
  )

  // fecha mínima: hoy + 28 días
  const minRequestedDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 28)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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

        const [mRes, cRes] = await Promise.all([
          fetch('/api/catalog/pool-models'),
          fetch('/api/catalog/colors'),
        ])

        const [mJson, cJson] = await Promise.all([mRes.json(), cRes.json()])

        if (!mRes.ok) throw new Error(mJson?.message || 'Error loading pool models')
        if (!cRes.ok) throw new Error(cJson?.message || 'Error loading colors')

        setModels(mJson.items || [])
        setColors(cJson.items || [])
      } catch (e: any) {
        setMsg({ type: 'err', text: e?.message || 'Error fetching data' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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
    } catch (e: any) {
      setMsg({
        type: 'err',
        text: e?.message || 'Network error during order creation.',
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pool Model */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pool Model
            </label>
            <div className="relative">
              <select
                value={poolModelId}
                onChange={(e) => setPoolModelId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                required
              >
                <option value="">Select pool model</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Ruler
                className="pointer-events-none absolute right-3 top-2.5 text-slate-400"
                size={18}
              />
            </div>

            {selectedModel && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  L: {selectedModel.lengthFt ?? '-'} ft
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  W: {selectedModel.widthFt ?? '-'} ft
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  D: {selectedModel.depthFt ?? '-'} ft
                </span>
              </div>
            )}
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