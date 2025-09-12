// app/dealer/agreement/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const aqua = '#00B2CA'
const deep = '#007A99'

export default function DealerAgreementSignPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user?.role !== 'DEALER') router.push('/login')
  }, [status, session, router])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = 600
    const h = 200
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
  }, [])

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    setDrawing(true)
    draw(e)
  }
  const end = () => setDrawing(false)

  const draw = (e: any) => {
    if (!drawing) return
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')!
    const point = (ev: any) => {
      const t = ev.touches ? ev.touches[0] : ev
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    const p = point(e)
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  const clear = () => {
    setError(null); setOk(null)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const submit = async () => {
    setError(null); setOk(null); setSigning(true)
    try {
      const canvas = canvasRef.current!
      const dataUrl = canvas.toDataURL('image/png')
      const res = await fetch('/api/dealer/agreement/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureDataUrl: dataUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || 'Failed to sign')
      setOk('Agreement signed successfully.')
      setTimeout(() => router.push('/dealer'), 900)
    } catch (e:any) {
      setError(e.message || 'Error signing agreement')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-4">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Dealer Agreement</h1>
        <p className="text-slate-600">Please review the document and sign below.</p>
        <div className="mt-4 grid lg:grid-cols-2 gap-4">
          <div className="rounded-lg overflow-hidden border">
            {/* Si tu plantilla está en /public/sample/Dealer-Agreement.pdf */}
            <iframe
              src="/sample/Glimmerglass Fiberglass Pools Dealership Agreement - Copy.pdf"
              className="w-full h-[520px]"
            />
          </div>
          <div>
            <div className="mb-2 text-sm text-slate-700">Your signature</div>
            <div className="rounded-lg border bg-white">
              <canvas
                ref={canvasRef}
                onMouseDown={start}
                onMouseMove={draw}
                onMouseUp={end}
                onMouseLeave={end}
                onTouchStart={start}
                onTouchMove={draw}
                onTouchEnd={end}
                className="w-[600px] h-[200px] max-w-full block"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={clear}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                onClick={submit}
                disabled={signing}
                className="h-10 px-4 rounded-xl text-white font-semibold shadow-lg disabled:opacity-50"
                style={{ backgroundImage: 'linear-gradient(90deg,#00B2CA,#007A99)' }}
              >
                {signing ? 'Signing…' : 'Sign & Submit'}
              </button>
            </div>
            {error && <p className="text-rose-600 mt-3 text-sm">{error}</p>}
            {ok && <p className="text-green-700 mt-3 text-sm">{ok}</p>}
          </div>
        </div>
      </div>

      <div
        className="h-1 w-full rounded-full"
        style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
      />
    </div>
  )
}