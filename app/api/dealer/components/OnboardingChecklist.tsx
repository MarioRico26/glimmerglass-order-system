// app/dealer/components/OnboardingChecklist.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { CheckCircle2, Upload, FileText, PenTool, ShoppingCart } from 'lucide-react'

type Step = { key: 'profile'|'tax'|'agreement'|'firstOrder'; label: string; done: boolean }
type Resp = {
    steps: Step[]
    progress: number
    dealer: { id: string; name: string | null; taxDocUrl?: string | null; agreementSignedAt?: string | null }
}

const aqua = '#00B2CA'
const deep = '#007A99'

export default function OnboardingChecklist() {
    const [data, setData] = useState<Resp | null>(null)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState<string | null>(null)
    const fileRef = useRef<HTMLInputElement | null>(null)
    const [uploading, setUploading] = useState(false)

    const load = async () => {
        setLoading(true); setErr(null)
        try {
            const res = await fetch('/api/dealer/onboarding', { cache: 'no-store' })
            if (!res.ok) throw new Error(await res.text())
            const json = (await res.json()) as Resp
            setData(json)
        } catch {
            setErr('Failed to load onboarding')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const uploadTax = async (file: File) => {
        const fd = new FormData()
        fd.append('file', file)
        setUploading(true)
        try {
            const res = await fetch('/api/dealer/docs/tax', { method: 'POST', body: fd })
            if (!res.ok) throw new Error(await res.text())
            await load()
        } catch {
            alert('Upload failed. Please try again.')
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    if (loading) return <div className="rounded-2xl border bg-white/80 p-4">Loading onboarding…</div>
    if (err || !data) return <div className="rounded-2xl border bg-white/80 p-4">{err || 'Error'}</div>

    const steps = data.steps
    const progress = data.progress

    const Row = ({ s }: { s: Step }) => {
        const common = 'flex items-center justify-between rounded-xl border p-3 bg-white'
        if (s.key === 'profile') {
            return (
                <div className={common}>
                    <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className={s.done ? 'text-green-600' : 'text-slate-500'} />
                        <div>
                            <div className="font-semibold text-slate-900">{s.label}</div>
                            <div className="text-xs text-slate-600">Add company details and contact info</div>
                        </div>
                    </div>
                    <Link href="/dealer/profile" className="text-sm font-semibold text-slate-800 hover:underline">
                        {s.done ? 'View' : 'Complete'}
                    </Link>
                </div>
            )
        }

        if (s.key === 'tax') {
            return (
                <div className={common}>
                    <div className="flex items-center gap-3">
                        <FileText size={18} className={s.done ? 'text-green-600' : 'text-slate-500'} />
                        <div>
                            <div className="font-semibold text-slate-900">{s.label}</div>
                            <div className="text-xs text-slate-600">Accepted format: PDF</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0]; if (f) uploadTax(f)
                            }}
                        />
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="inline-flex items-center gap-2 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                            title="Upload tax document"
                        >
                            <Upload size={16} />
                            {s.done ? 'Replace' : 'Upload'}
                        </button>
                    </div>
                </div>
            )
        }

        if (s.key === 'agreement') {
            return (
                <div className={common}>
                    <div className="flex items-center gap-3">
                        <PenTool size={18} className={s.done ? 'text-green-600' : 'text-slate-500'} />
                        <div>
                            <div className="font-semibold text-slate-900">{s.label}</div>
                            <div className="text-xs text-slate-600">Sign the dealer agreement digitally</div>
                        </div>
                    </div>
                    <Link href="/dealer/agreement" className="text-sm font-semibold text-slate-800 hover:underline">
                        {s.done ? 'View' : 'Sign'}
                    </Link>
                </div>
            )
        }

        // firstOrder
        return (
            <div className={common}>
                <div className="flex items-center gap-3">
                    <ShoppingCart size={18} className={s.done ? 'text-green-600' : 'text-slate-500'} />
                    <div>
                        <div className="font-semibold text-slate-900">{s.label}</div>
                        <div className="text-xs text-slate-600">Use your saved templates or start from scratch</div>
                    </div>
                </div>
                <Link href="/dealer/new-order" className="text-sm font-semibold text-slate-800 hover:underline">
                    {s.done ? 'Add another' : 'Start'}
                </Link>
            </div>
        )
    }

    return (
        <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-slate-900">Getting started</h3>
                <div className="text-sm font-semibold text-slate-700">{progress}%</div>
            </div>
            <div className="h-2 rounded-xl bg-slate-100 overflow-hidden mb-4">
                <div
                    className="h-full"
                    style={{
                        width: `${progress}%`,
                        backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})`
                    }}
                />
            </div>
            <div className="grid gap-3">
                {steps.map((s) => <Row key={s.key} s={s} />)}
            </div>
        </div>
    )
}