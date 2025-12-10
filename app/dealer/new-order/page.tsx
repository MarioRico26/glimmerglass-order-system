// app/dealer/new-order/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Loader2,
  PackagePlus,
  MapPin,
  StickyNote,
  CreditCard,
  CheckSquare,
  Truck,
  Pool as PoolIcon,
  Droplets,
} from 'lucide-react'

type PoolModel = {
  id: string
  name: string
}

type Color = {
  id: string
  name: string
}

type ShippingMethod = 'PICK_UP' | 'QUOTE' | ''

const aqua = '#00B2CA'
const deep = '#007A99'

export default function DealerNewOrderPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [poolModels, setPoolModels] = useState<PoolModel[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [poolModelId, setPoolModelId] = useState('')
  const [colorId, setColorId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('')
  const [paymentFile, setPaymentFile] = useState<File | null>(null)

  const [hardwareSkimmer, setHardwareSkimmer] = useState(false)
  const [hardwareReturns, setHardwareReturns] = useState(false)
  const [hardwareMainDrains, setHardwareMainDrains] = useState(false)
  const [hardwareAutocover, setHardwareAutocover] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 1) Protección de ruta: solo dealer logueado
  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user?.role !== 'DEALER') {
      router.push('/login')
    }
  }, [session, status, router])

  // 2) Cargar modelos y colores
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingOptions(true)
        setError(null)

        // Ajusta estas URLs si en tu backend se llaman distinto
        const [modelsRes, colorsRes] = await Promise.all([
          fetch('/api/pool-models', { cache: 'no-store' }),
          fetch('/api/colors', { cache: 'no-store' }),
        ])

        if (!modelsRes.ok) throw new Error('Failed to load pool models')
        if (!colorsRes.ok) throw new Error('Failed to load colors')

        const models = (await modelsRes.json()) as PoolModel[]
        const colorsJson = (await colorsRes.json()) as Color[]

        setPoolModels(models)
        setColors(colorsJson)

        if (models.length && !poolModelId) setPoolModelId(models[0].id)
        if (colorsJson.length && !colorId) setColorId(colorsJson[0].id)
      } catch (e: any) {
        console.error(e)
        setError('Failed to load options for new order.')
      } finally {
        setLoadingOptions(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!poolModelId || !colorId || !deliveryAddress) {
      setError('Model, color and delivery address are required.')
      return
    }
    if (!shippingMethod) {
      setError('Please select a shipping method.')
      return
    }

    try {
      setSubmitting(true)

      const fd = new FormData()
      fd.append('poolModelId', poolModelId)
      fd.append('colorId', colorId)
      fd.append('deliveryAddress', deliveryAddress)
      fd.append('notes', notes)
      fd.append('shippingMethod', shippingMethod)

      fd.append('hardwareSkimmer', String(hardwareSkimmer))
      fd.append('hardwareReturns', String(hardwareReturns))
      fd.append('hardwareMainDrains', String(hardwareMainDrains))
      fd.append('hardwareAutocover', String(hardwareAutocover))

      if (paymentFile) {
        fd.append('paymentProof', paymentFile)
      }

      // El backend /api/orders ya debería usar FormData,
      // subir el comprobante con @vercel/blob y crear la orden.
      const res = await fetch('/api/orders', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('Create order failed:', text)
        throw new Error(text || `Failed with status ${res.status}`)
      }

      setSuccess('Order created successfully.')
      setTimeout(() => router.push('/dealer/orders'), 1500)
    } catch (e: any) {
      console.error(e)
      setError('Could not create order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || !session) {
    return (
      <div className="p-6 flex items-center gap-2 text-slate-600">
        <Loader2 className="animate-spin" size={18} /> Checking session…
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
            <PackagePlus size={26} className="text-slate-700" />
            New Order
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            Select a pool model, color, hardware and shipping method.
          </p>
        </div>
        <Link
          href="/dealer"
          className="text-sm text-slate-700 hover:underline font-semibold"
        >
          Back to dashboard
        </Link>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Warning si no hay opciones */}
      {loadingOptions && (
        <div className="mb-4 flex items-center gap-2 text-slate-600 text-sm">
          <Loader2 className="animate-spin" size={16} />
          Loading pool models and colors…
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_16px_40px_rgba(0,122,153,0.12)] p-4 sm:p-6 space-y-6"
      >
        {/* Pool model & color */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Pool Model
            </label>
            <div className="relative">
              <PoolIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                value={poolModelId}
                onChange={(e) => setPoolModelId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
                disabled={loadingOptions || !poolModels.length}
                required
              >
                {poolModels.length === 0 && (
                  <option value="">No models available</option>
                )}
                {poolModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Color
            </label>
            <div className="relative">
              <Droplets
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                value={colorId}
                onChange={(e) => setColorId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
                disabled={loadingOptions || !colors.length}
                required
              >
                {colors.length === 0 && (
                  <option value="">No colors available</option>
                )}
                {colors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Delivery Address
          </label>
          <div className="relative">
            <MapPin
              size={16}
              className="absolute left-3 top-3 text-slate-400"
            />
            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm"
              placeholder="Street, city, state, ZIP"
              required
            />
          </div>
        </div>

        {/* Shipping method */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={18} className="text-slate-600" />
            <p className="font-semibold text-slate-900 text-sm">
              Shipping Method
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="shippingMethod"
                value="PICK_UP"
                checked={shippingMethod === 'PICK_UP'}
                onChange={(e) =>
                  setShippingMethod(e.target.value as ShippingMethod)
                }
              />
              <span>
                <span className="font-semibold">Pick Up</span>{' '}
                <span className="text-slate-500">
                  (Dealer will arrange pickup at factory)
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="shippingMethod"
                value="QUOTE"
                checked={shippingMethod === 'QUOTE'}
                onChange={(e) =>
                  setShippingMethod(e.target.value as ShippingMethod)
                }
              />
              <span>
                <span className="font-semibold">Shipping Quote</span>{' '}
                <span className="text-slate-500">
                  (Request Kline to provide a freight quote)
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Hardware checkboxes */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare size={18} className="text-slate-600" />
            <p className="font-semibold text-slate-900 text-sm">
              Hardware (included with this order)
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-800">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hardwareSkimmer}
                onChange={(e) => setHardwareSkimmer(e.target.checked)}
              />
              Skimmer
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hardwareReturns}
                onChange={(e) => setHardwareReturns(e.target.checked)}
              />
              Returns
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hardwareMainDrains}
                onChange={(e) => setHardwareMainDrains(e.target.checked)}
              />
              Main Drains
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hardwareAutocover}
                onChange={(e) => setHardwareAutocover(e.target.checked)}
              />
              Autocover
            </label>
          </div>
        </div>

        {/* Payment proof */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={18} className="text-slate-600" />
            <p className="font-semibold text-slate-900 text-sm">
              Payment Proof (optional)
            </p>
          </div>
          <p className="text-xs text-slate-500 mb-2">
            You can upload a copy of the wire / check / payment confirmation.
            If you skip this, the order will stay in{' '}
            <strong>Pending Payment Approval</strong>.
          </p>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Notes (optional)
          </label>
          <div className="relative">
            <StickyNote
              size={16}
              className="absolute left-3 top-3 text-slate-400"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm"
              placeholder="Special instructions, crane access info, etc."
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Link
            href="/dealer/orders"
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="h-10 px-6 rounded-2xl text-sm font-bold text-white shadow-[0_10px_30px_rgba(0,122,153,0.25)] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundImage: `linear-gradient(90deg,${aqua},${deep})` }}
          >
            {submitting ? 'Submitting…' : 'Submit Order'}
          </button>
        </div>
      </form>
    </div>
  )
}