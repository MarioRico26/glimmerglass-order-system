//glimmerglass-order-system/app/dealer/new-order/page.tsx:
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
  CheckSquare
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

type ShippingMethod = 'PICK_UP' | 'QUOTE' | ''

const aqua = '#00B2CA'
const deep = '#007A99'

export default function NewOrderPage() {
  // form
  const [dealerId, setDealerId] = useState('')
  const [poolModelId, setPoolModelId] = useState('')
  const [colorId, setColorId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('')
  const [notes, setNotes] = useState('')
  const [paymentProof, setPaymentProof] = useState<File | null>(null)

  // hardware checkboxes (se guardan como booleans)
  const [hardwareSkimmer, setHardwareSkimmer] = useState(false)
  const [hardwareReturns, setHardwareReturns] = useState(false)
  const [hardwareMainDrains, setHardwareMainDrains] = useState(false)
  const [hardwareAutocover, setHardwareAutocover] = useState(false)

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

  // fetch initial (dealer + catálogos)
  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)

        const dealerRes = await fetch('/api/dealer/me')
        const dealerJson = await dealerRes.json()
        if (dealerRes.ok && dealerJson?.dealerId) setDealerId(dealerJson.dealerId)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    if (!dealerId)
      return setMsg({
        type: 'err',
        text: 'Dealer not detected. Please sign in again.',
      })

    if (!poolModelId || !colorId || !deliveryAddress)
      return setMsg({
        type: 'err',
        text: 'Please complete model, color and delivery address.',
      })

    if (!shippingMethod)
      return setMsg({
        type: 'err',
        text: 'Please select a shipping method.',
      })

    try {
      setSubmitting(true)

      const formData = new FormData()
      formData.append('dealerId', dealerId)
      formData.append('poolModelId', poolModelId)
      formData.append('colorId', colorId)
      formData.append('deliveryAddress', deliveryAddress)
      formData.append('notes', notes)
      formData.append('shippingMethod', shippingMethod)

      // hardware flags
      formData.append('hardwareSkimmer', String(hardwareSkimmer))
      formData.append('hardwareReturns', String(hardwareReturns))
      formData.append('hardwareMainDrains', String(hardwareMainDrains))
      formData.append('hardwareAutocover', String(hardwareAutocover))

      // payment proof opcional
      if (paymentProof) {
        formData.append('paymentProof', paymentProof)
      }

      const res = await fetch('/api/orders', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data?.message || 'Order creation failed')

      setMsg({ type: 'ok', text: 'Order created successfully.' })

      // reset básico
      setPoolModelId('')
      setColorId('')
      setDeliveryAddress('')
      setNotes('')
      setShippingMethod('')
      setHardwareSkimmer(false)
      setHardwareReturns(false)
      setHardwareMainDrains(false)
      setHardwareAutocover(false)
      setPaymentProof(null)
    } catch (e: any) {
      setMsg({
        type: 'err',
        text: e?.message || 'Network error during order creation',
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
            {[...Array(6)].map((_, i) => (
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
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">New Order</h1>
          <p className="text-slate-600">
            Create a new pool order with model, color, hardware and delivery details.
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
            {msg.type === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Model */}
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

          {/* Delivery address (muy específico) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Delivery Address (be very specific)
            </label>
            <div className="relative">
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder={
                  'Street address, city, state, ZIP.\n' +
                  'Include site details: gate width, overhead wires, steep driveway, limited truck access, etc.'
                }
                required
              />
              <Truck
                className="pointer-events-none absolute right-3 top-2.5 text-slate-300"
                size={18}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              This is what logistics will use. If it’s vague, they’ll call you… and you hate those calls.
            </p>
          </div>

          {/* Shipping method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Shipping Method
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="shippingMethod"
                  value="PICK_UP"
                  checked={shippingMethod === 'PICK_UP'}
                  onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                />
                <span>
                  <span className="font-semibold text-slate-900">Pick Up</span>{' '}
                  <span className="text-slate-600">
                    Dealer will arrange pickup at the assigned factory.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="shippingMethod"
                  value="QUOTE"
                  checked={shippingMethod === 'QUOTE'}
                  onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                />
                <span>
                  <span className="font-semibold text-slate-900">Shipping Quote</span>{' '}
                  <span className="text-slate-600">
                    Request Kline to provide a freight quote for delivery.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Hardware */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hardware Included
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 grid sm:grid-cols-2 gap-2 text-sm text-slate-800">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hardwareSkimmer}
                  onChange={(e) => setHardwareSkimmer(e.target.checked)}
                />
                <span>Skimmer</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hardwareReturns}
                  onChange={(e) => setHardwareReturns(e.target.checked)}
                />
                <span>Returns</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hardwareMainDrains}
                  onChange={(e) => setHardwareMainDrains(e.target.checked)}
                />
                <span>Main Drains</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hardwareAutocover}
                  onChange={(e) => setHardwareAutocover(e.target.checked)}
                />
                <span>Autocover</span>
              </label>
            </div>
            <p className="text-xs text-slate-500 mt-1">
            </p>
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
              placeholder="Any special instructions, crane info, timing constraints, etc."
            />
          </div>

          {/* Payment proof (opcional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Payment Proof (image or PDF, optional)
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
                  onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              {paymentProof && (
                <span className="text-xs text-slate-500">
                  {(paymentProof.size / 1024 / 1024).toFixed(2)} MB
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              If you skip this, accounting will mark the order as{' '}
              <strong>Pending Payment Approval</strong> until proof is received.
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