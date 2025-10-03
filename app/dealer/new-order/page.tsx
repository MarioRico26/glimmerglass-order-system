'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Palette,
  Factory as FactoryIcon,
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

type Factory = {
  id: string
  name: string
  city?: string | null
  state?: string | null
}

const aqua = '#00B2CA'
const deep = '#007A99'

export default function NewOrderPage() {
  // form
  const [dealerId, setDealerId] = useState('')
  const [poolModelId, setPoolModelId] = useState('')
  const [colorId, setColorId] = useState('')
  const [factoryLocationId, setFactoryLocationId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentProof, setPaymentProof] = useState<File | null>(null)

  // NEW: Hardware checkboxes
  const [hardwareSkimmer, setHardwareSkimmer] = useState(false)
  const [hardwareAutocover, setHardwareAutocover] = useState(false)
  const [hardwareReturns, setHardwareReturns] = useState(false)
  const [hardwareMainDrains, setHardwareMainDrains] = useState(false)

  // data
  const [models, setModels] = useState<PoolModel[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [factories, setFactories] = useState<Factory[]>([])

  // ui
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{type: 'ok'|'err'; text: string} | null>(null)

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

        const [mRes, cRes, fRes] = await Promise.all([
          fetch('/api/catalog/pool-models'),
          fetch('/api/catalog/colors'),
          fetch('/api/catalog/factories')
        ])
        const [mJson, cJson, fJson] = await Promise.all([
          mRes.json(), cRes.json(), fRes.json()
        ])
        if (!mRes.ok) throw new Error(mJson?.message || 'Error loading pool models')
        if (!cRes.ok) throw new Error(cJson?.message || 'Error loading colors')
        if (!fRes.ok) throw new Error(fJson?.message || 'Error loading factories')

        setModels(mJson.items || [])
        setColors(cJson.items || [])
        setFactories(fJson.items || [])
      } catch (e:any) {
        setMsg({ type:'err', text: e?.message || 'Error fetching data' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    if (!dealerId) return setMsg({ type:'err', text:'Dealer not detected. Please sign in again.' })
    if (!poolModelId || !colorId || !factoryLocationId || !deliveryAddress)
      return setMsg({ type:'err', text:'Please complete all required fields.' })
    if (!paymentProof) return setMsg({ type:'err', text:'Please attach the payment proof.' })

    try {
      setSubmitting(true)
      const formData = new FormData()
      formData.append('dealerId', dealerId)
      formData.append('poolModelId', poolModelId)
      formData.append('colorId', colorId)
      formData.append('factoryLocationId', factoryLocationId)
      formData.append('deliveryAddress', deliveryAddress)
      formData.append('notes', notes)
      formData.append('paymentProof', paymentProof)

      // NEW: append checkboxes
      formData.append('hardwareSkimmer', hardwareSkimmer ? 'true' : 'false')
      formData.append('hardwareAutocover', hardwareAutocover ? 'true' : 'false')
      formData.append('hardwareReturns', hardwareReturns ? 'true' : 'false')
      formData.append('hardwareMainDrains', hardwareMainDrains ? 'true' : 'false')

      const res = await fetch('/api/orders', { method:'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Order creation failed')

      setMsg({ type:'ok', text:'Order created successfully' })
      setPoolModelId('')
      setColorId('')
      setFactoryLocationId('')
      setDeliveryAddress('')
      setNotes('')
      setPaymentProof(null)
      // reset hardware checkboxes
      setHardwareSkimmer(false)
      setHardwareAutocover(false)
      setHardwareReturns(false)
      setHardwareMainDrains(false)
    } catch (e:any) {
      setMsg({ type:'err', text: e?.message || 'Network error during order creation' })
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
            {[...Array(6)].map((_,i)=>(
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
          <p className="text-slate-600">Create a new pool order with model, color and factory.</p>
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
          {/* Pool Model */}
          {/* ... OMITIDO por espacio ... */}

          {/* Factory */}
          {/* ... OMITIDO por espacio ... */}

          {/* Delivery Address */}
          {/* ... OMITIDO por espacio ... */}

          {/* Notes */}
          {/* ... OMITIDO por espacio ... */}

          {/* Payment Proof */}
          {/* ... OMITIDO por espacio ... */}

          {/* NEW: Hardware checkboxes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pool Hardware (check all that apply)
            </label>
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

      <div
        className="mt-6 h-1 w-full rounded-full"
        style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
      />
    </div>
  )
}