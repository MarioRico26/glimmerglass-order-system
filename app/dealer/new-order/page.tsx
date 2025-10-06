'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Palette,
  Truck,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ruler
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

  // Hardware checkboxes
  const [hardwareSkimmer, setHardwareSkimmer] = useState(false)
  const [hardwareAutocover, setHardwareAutocover] = useState(false)
  const [hardwareReturns, setHardwareReturns] = useState(false)
  const [hardwareMainDrains, setHardwareMainDrains] = useState(false)

  // data
  const [models, setModels] = useState<PoolModel[]>([])
  const [colors, setColors] = useState<Color[]>([])

  // ui
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const selectedModel = useMemo(
    () => models.find(m => m.id === poolModelId) ?? null,
    [models, poolModelId]
  )

  // fetch initial
  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const dealerRes = await fetch('/api/dealer/me')
        const dealerJson = await dealerRes.json()
        if (dealerRes.ok && dealerJson?.dealerId) setDealerId(dealerJson.dealerId)

        const [mRes, cRes] = await Promise.all([
          fetch('/api/catalog/pool-models'),
          fetch('/api/catalog/colors')
        ])
        const [mJson, cJson] = await Promise.all([
          mRes.json(), cRes.json()
        ])
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

    if (!dealerId) return setMsg({ type: 'err', text: 'Dealer not detected. Please sign in again.' })
    if (!poolModelId || !colorId || !deliveryAddress)
      return setMsg({ type: 'err', text: 'Please complete all required fields.' })
    if (!paymentProof) return setMsg({ type: 'err', text: 'Please attach the payment proof.' })

    try {
      setSubmitting(true)
      const formData = new FormData()
      formData.append('dealerId', dealerId)
      formData.append('poolModelId', poolModelId)
      formData.append('colorId', colorId)
      formData.append('deliveryAddress', deliveryAddress)
      formData.append('notes', notes)
      formData.append('paymentProof', paymentProof)

      // Append hardware checkboxes
      formData.append('hardwareSkimmer', hardwareSkimmer ? 'true' : 'false')
      formData.append('hardwareAutocover', hardwareAutocover ? 'true' : 'false')
      formData.append('hardwareReturns', hardwareReturns ? 'true' : 'false')
      formData.append('hardwareMainDrains', hardwareMainDrains ? 'true' : 'false')

      const res = await fetch('/api/orders', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Order creation failed')

      setMsg({ type: 'ok', text: 'Order created successfully' })
      setPoolModelId('')
      setColorId('')
      setDeliveryAddress('')
      setNotes('')
      setPaymentProof(null)
      setHardwareSkimmer(false)
      setHardwareAutocover(false)
      setHardwareReturns(false)
      setHardwareMainDrains(false)
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || 'Network error during order creation' })
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
          <p className="text-slate-600">Create a new pool order with model, color, and hardware options.</p>
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
            {msg.type === 'ok' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pool model */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pool Model</label>
            <select
              value={poolModelId}
              onChange={(e) => setPoolModelId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2 text-sm"
            >
              <option value="">Select a model</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.lengthFt && model.widthFt && model.depthFt ? `(${model.lengthFt}ft x ${model.widthFt}ft x ${model.depthFt}ft)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
            <select
              value={colorId}
              onChange={(e) => setColorId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2 text-sm"
            >
              <option value="">Select a color</option>
              {colors.map((color) => (
                <option key={color.id} value={color.id}>
                  {color.name}
                </option>
              ))}
            </select>
          </div>

          {/* Delivery address */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Address</label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2 text-sm"
              placeholder="Street, city, state, ZIP"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-300 p-2 text-sm"
              placeholder="Optional notes or instructions"
            />
          </div>

          {/* Hardware checkboxes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pool Hardware (check all that apply)</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hardwareSkimmer} onChange={(e) => setHardwareSkimmer(e.target.checked)} className="accent-sky-600"/>
                <span className="text-slate-800 text-sm">Skimmer</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hardwareAutocover} onChange={(e) => setHardwareAutocover(e.target.checked)} className="accent-sky-600"/>
                <span className="text-slate-800 text-sm">Autocover</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hardwareReturns} onChange={(e) => setHardwareReturns(e.target.checked)} className="accent-sky-600"/>
                <span className="text-slate-800 text-sm">Returns</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hardwareMainDrains} onChange={(e) => setHardwareMainDrains(e.target.checked)} className="accent-sky-600"/>
                <span className="text-slate-800 text-sm">Main Drains</span>
              </label>
            </div>
          </div>
          <div className="mt-2 rounded-md bg-gray-100 p-3 text-xs text-gray-700">
            <strong>Hardware:</strong> Skimmer, Main Drain, Returns included and shipped loose.
            <br />
            <span className="text-red-600 font-semibold">
              $125 per penetration if installed by Glimmerglass.
            </span>
          </div>

          {/* Payment proof */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Proof (PDF or Image)</label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setPaymentProof(e.target.files[0])
                }
              }}
              className="text-sm"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-sky-600 text-white py-2 px-4 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="animate-spin w-4 h-4 inline-block" /> : 'Submit Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}