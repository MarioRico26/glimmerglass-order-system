// app/(auth)/register/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Mail, Lock, Building2, MapPin, Phone, FileText, Landmark,
    Eye, EyeOff, User2, PenTool, CheckCircle2
} from 'lucide-react'

const STATES = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
]

export default function RegisterPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', address: '', phone: '', state: '', city: '',
    })
    const [agreementFile, setAgreementFile] = useState<File | null>(null)
    const [error, setError] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [showPwd, setShowPwd] = useState(false)

    const onChange = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(f => ({ ...f, [name]: value }))
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(''); setSubmitted(false)

        const fd = new FormData()
        Object.entries(formData).forEach(([k, v]) => fd.append(k, v as string))
        if (agreementFile) fd.append('agreement', agreementFile) // PDF opcional

        try {
            setLoading(true)
            const res = await fetch('/api/register', { method: 'POST', body: fd })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) { setError(data?.message || 'Something went wrong'); return }
            setSubmitted(true)
        } catch {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    // paleta de alto contraste
    const text = '#0f172a'      // slate-900
    const textSub = '#334155'   // slate-700
    const line = '#94a3b8'      // slate-400
    const aqua = '#00B2CA'
    const deep = '#007A99'

    const pwdLen = formData.password.length
    const pwdPct = Math.min(100, pwdLen * 12)
    const strengthColor = pwdLen >= 10 ? '#16a34a' : pwdLen >= 6 ? '#eab308' : '#ef4444'

    return (
        <div
            className="min-h-screen flex items-center justify-center p-6"
            style={{
                // Fondo claro, suave, sin negro
                background:
                    'radial-gradient(1200px 700px at 85% -10%, #E6F7FA 0%, transparent 60%), ' +
                    'radial-gradient(900px 600px at 10% 100%, rgba(0,178,202,.10) 0%, transparent 60%), ' +
                    'linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)'
            }}
        >
            <div
                className="w-full max-w-5xl rounded-3xl border overflow-hidden"
                style={{
                    borderColor: '#e2e8f0',
                    background: 'rgba(255,255,255,0.85)',
                    boxShadow: '0 24px 60px rgba(0,122,153,0.13)',
                    backdropFilter: 'blur(8px)'
                }}
            >
                <div className="grid md:grid-cols-5">
                    {/* Lado izquierdo */}
                    <aside className="hidden md:flex md:col-span-2 flex-col gap-6 p-8 border-r bg-white/60"
                           style={{ borderColor: '#e2e8f0' }}>
                        <div className="h-40 rounded-2xl bg-slate-200/60" />
                        <h2 className="text-2xl font-extrabold" style={{ color: text }}>
                            Become an Authorized Dealer
                        </h2>
                        <p className="text-sm leading-6" style={{ color: textSub }}>
                            Fast onboarding, prioritized production slots and transparent order tracking.
                            Upload a signed PDF or sign the agreement digitally after approval.
                        </p>
                        <ul className="text-sm space-y-2" style={{ color: text }}>
                            <li>• Secure account & role-based access</li>
                            <li>• Real-time order status & history</li>
                            <li>• Media uploads & approvals</li>
                        </ul>
                    </aside>

                    {/* Formulario */}
                    <main className="md:col-span-3 p-6 md:p-8">
                        <div className="flex items-center justify-between mb-3">
                            <h1 className="text-3xl font-black" style={{ color: text }}>Register Dealer</h1>
                            <span
                                className="inline-flex items-center gap-2 text-xs font-bold px-2.5 py-1 rounded-full border bg-white/70"
                                style={{ borderColor: '#93c5fd', color: '#1d4ed8' }}
                            >
                <PenTool size={14} /> Digital Signature Ready
              </span>
                        </div>

                        <p className="text-[15px] mb-4" style={{ color: text }}>
                            Option A: Upload the signed{' '}
                            <a
                                href="/sample/Glimmerglass Fiberglass Pools Dealership Agreement - Copy.pdf"
                                target="_blank" rel="noopener noreferrer"
                                className="underline font-bold"
                                style={{ color: deep }}
                            >
                                Dealer Agreement (PDF)
                            </a>
                            .<br />
                            Option B: Sign digitally after <strong>admin approval</strong>.
                        </p>

                        <div
                            className="mb-5 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] bg-white/70"
                            style={{ borderColor: line, color: text }}
                        >
                            <PenTool size={16} />
                            If you skip the PDF upload, you’ll receive access to digital signing once approved.
                        </div>

                        {!submitted ? (
                            <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4" encType="multipart/form-data">
                                {/* 1. Dealer Name */}
                                <Field label="Dealer Name" icon={<User2 size={16} />} text={text}>
                                    <input id="name" name="name" value={formData.name} onChange={onChange}
                                           required placeholder="Your company LLC" className="field-input" />
                                </Field>

                                {/* 2. Email */}
                                <Field label="Email" icon={<Mail size={16} />} text={text}>
                                    <input id="email" name="email" type="email" autoComplete="email"
                                           value={formData.email} onChange={onChange} required placeholder="you@company.com"
                                           className="field-input" />
                                </Field>

                                {/* 3. Password */}
                                <Field label="Password" icon={<Lock size={16} />} text={text}>
                                    <div className="relative">
                                        <input
                                            id="password" name="password"
                                            type={showPwd ? 'text' : 'password'}
                                            value={formData.password} onChange={onChange}
                                            autoComplete="new-password" required placeholder="••••••••"
                                            className="field-input pr-10"
                                            aria-describedby="pwd-hint"
                                        />
                                        <button
                                            type="button" onClick={() => setShowPwd(s => !s)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100"
                                            aria-label={showPwd ? 'Hide password' : 'Show password'}>
                                            {/* gris oscuro */}
                                            {showPwd ? <EyeOff size={18} className="text-slate-700" /> : <Eye size={18} className="text-slate-700" />}
                                        </button>
                                    </div>
                                    <div id="pwd-hint" className="mt-1 h-1.5 w-full rounded bg-slate-200 overflow-hidden" aria-hidden>
                                        <div className="h-full transition-all" style={{ width: `${pwdPct}%`, background: strengthColor }} />
                                    </div>
                                </Field>

                                {/* 4. State */}
                                <Field label="State" icon={<Landmark size={16} />} text={text}>
                                    <select id="state" name="state" value={formData.state} onChange={onChange}
                                            required className="field-input">
                                        <option value="">Select a state</option>
                                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </Field>

                                {/* 5. City */}
                                <Field label="City" icon={<MapPin size={16} />} text={text}>
                                    <input id="city" name="city" value={formData.city} onChange={onChange}
                                           required placeholder="Your city" className="field-input" />
                                </Field>

                                {/* 6. Phone */}
                                <Field label="Phone" icon={<Phone size={16} />} text={text}>
                                    <input id="phone" name="phone" value={formData.phone} onChange={onChange}
                                           required placeholder="(555) 555-5555" className="field-input" />
                                </Field>

                                {/* 7. Address (ocupa 2 columnas) */}
                                <div className="sm:col-span-2">
                                    <Field label="Address" icon={<Building2 size={16} />} text={text}>
                                        <input
                                            id="address" name="address" value={formData.address} onChange={onChange}
                                            required placeholder="55 Willett St, Fort Plain, NY"
                                            className="field-input"
                                        />
                                    </Field>
                                </div>

                                {/* PDF opcional */}
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-bold mb-1" style={{ color: text }}>
                                        Upload Signed Dealer Agreement (PDF) — optional
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-slate-100"
                                             style={{ color: text }}>
                                            <FileText size={18} />
                                        </div>
                                        <input
                                            type="file" accept=".pdf"
                                            onChange={e => setAgreementFile(e.target.files?.[0] || null)}
                                            className="field-input" />
                                    </div>
                                    <p className="mt-1 text-xs" style={{ color: textSub }}>
                                        If you don’t upload it now, you can sign digitally after approval.
                                    </p>
                                </div>

                                {error && (
                                    <div className="sm:col-span-2 rounded-lg px-3 py-2 text-sm"
                                         style={{ color:'#991b1b', background:'#fee2e2', border:'1px solid #fecaca' }}>
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit" disabled={loading}
                                    className="sm:col-span-2 h-12 rounded-2xl font-bold text-white shadow-[0_10px_30px_rgba(0,122,153,0.25)] transition-transform active:scale-[0.99] disabled:opacity-50"
                                    style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}>
                                    {loading ? 'Submitting…' : 'Register'}
                                </button>

                                <p className="sm:col-span-2 text-center text-sm" style={{ color: text }}>
                                    Already have an account?{' '}
                                    <a href="/login" className="underline font-bold" style={{ color: deep }}>Sign in</a>
                                </p>
                            </form>
                        ) : (
                            <div className="rounded-2xl p-5 bg-white/80 border" style={{ borderColor: '#a7f3d0' }}>
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5" style={{ color:'#047857' }}><CheckCircle2 /></div>
                                    <div>
                                        <h3 className="text-lg font-bold" style={{ color:'#064e3b' }}>Application submitted</h3>
                                        <p className="text-sm mt-1" style={{ color:'#065f46' }}>
                                            Thanks! Your dealer account is pending admin approval.
                                            If you didn’t upload a PDF, you’ll be able to sign digitally once approved.
                                        </p>
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                onClick={() => router.push('/login')}
                                                className="h-10 rounded-xl px-4 font-semibold border bg-white hover:bg-slate-50"
                                                style={{ borderColor:'#cbd5e1', color: text }}>
                                                Go to login
                                            </button>
                                            <button
                                                onClick={() => router.push('/')}
                                                className="h-10 rounded-xl text-white font-semibold px-4"
                                                style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}>
                                                Back to home
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* estilos de campo en alto contraste */}
            <style jsx global>{`
        .field-input {
          border: 1px solid #94a3b8; /* slate-400 */
          background: #ffffff;
          color: #0f172a;             /* slate-900 */
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.625rem 0.75rem;
          font-size: 15px;
          transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
        }
        .field-input::placeholder { color: #64748b; } /* slate-500/600 */
        .field-input:focus {
          outline: none;
          box-shadow: 0 0 0 3px #00B2CA22;
          border-color: #007A99;
          background: #fff;
        }
      `}</style>
        </div>
    )
}

function Field({
                   label, icon, children, text,
               }: { label: string; icon?: React.ReactNode; children: React.ReactNode; text: string }) {
    return (
        <div className="grid gap-1.5">
            <label className="text-sm font-bold" style={{ color: text }}>{label}</label>
            <div className="relative">
                {icon && (
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#334155' }}>
            {icon}
          </span>
                )}
                {/* padding para no superponer el ícono */}
                <div className={icon ? 'pl-7' : ''}>{children}</div>
            </div>
        </div>
    )
}