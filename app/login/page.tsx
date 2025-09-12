'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Mail, Eye, EyeOff, ShieldAlert } from 'lucide-react'

function LoginInner() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  // Si YA hay sesión y entran a /login, llévalos a post-login sin pintar el form
  useEffect(() => {
    if (status === 'authenticated') router.replace('/post-login')
  }, [status, router])

  // Mensajes de error por query (?error=...)
  const qsError = useMemo(() => searchParams?.get('error') || '', [searchParams])
  useEffect(() => {
    if (!qsError) return
    if (qsError === 'PENDING_APPROVAL') {
      setError('⏳ Your dealer account is pending admin approval.')
    } else if (qsError === 'INVALID_CREDENTIALS' || qsError === 'CredentialsSignin') {
      setError('❌ Invalid credentials.')
    } else {
      setError('Something went wrong. Please try again.')
    }
  }, [qsError])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 👇 redirect:false para que NO redirija a páginas de error y podamos manejarlo aquí
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      // Puede venir "PENDING_APPROVAL" (nuestro) o "CredentialsSignin" (credenciales malas)
      if (res.error === 'PENDING_APPROVAL') {
        setError('⏳ Your dealer account is pending admin approval.')
      } else if (res.error === 'INVALID_CREDENTIALS' || res.error === 'CredentialsSignin') {
        setError('❌ Invalid credentials.')
      } else {
        setError('Something went wrong. Please try again.')
      }
      return
    }

    // Éxito: navega a /post-login (centraliza la decisión de destino y evita flicker)
    router.replace('/post-login')
  }

  // Paleta / estilos
  const text = '#0f172a'
  const aqua = '#00B2CA'
  const deep = '#007A99'

  // Mientras verifica sesión o si ya hay sesión, no pintes el form (evita parpadeo)
  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6"
           style={{ background: 'linear-gradient(180deg, #f2f7f9 0%, #e9f2f5 100%)' }}>
        <div className="text-slate-600">Loading…</div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 700px at 90% 5%, #e6f7fa 0%, transparent 60%), ' +
          'radial-gradient(900px 600px at 10% 100%, rgba(0,178,202,.10) 0%, transparent 60%), ' +
          'linear-gradient(180deg, #f2f7f9 0%, #e9f2f5 100%)'
      }}
    >
      <div className="relative w-full max-w-md">
        <div className="absolute -inset-[1.5px] rounded-[28px] blur-sm"
             style={{ background: `linear-gradient(120deg, ${aqua}, ${deep})` }} />
        <div className="relative rounded-[28px] bg-white border border-slate-200 shadow-[0_16px_40px_rgba(0,0,0,0.08)] p-7">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 mb-3">
              <Lock />
            </div>
            <h1 className="text-2xl font-extrabold" style={{ color: text }}>Welcome back</h1>
            <p className="text-slate-700 text-sm mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* Email */}
            <div className="grid gap-1.5">
              <label className="text-sm font-bold" style={{ color: text }}>Email</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e=>setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="field-input"
                  style={{ ['--fi-pl' as any]: '3rem' }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="grid gap-1.5">
              <label className="text-sm font-bold" style={{ color: text }}>Password</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock size={18}/>
                </span>
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="field-input"
                  style={{ ['--fi-pl' as any]: '3rem', ['--fi-pr' as any]: '3rem' }}
                />
                <button
                  type="button"
                  onClick={()=>setShow(s=>!s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 text-slate-700"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg px-3 py-2 text-sm flex items-center gap-2"
                   style={{ color:'#991b1b', background:'#fee2e2', border:'1px solid #fecaca' }}>
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-2xl font-bold text-white shadow-[0_10px_30px_rgba(0,122,153,0.25)] transition-transform active:scale-[0.99] disabled:opacity-50"
              style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="text-center text-sm text-slate-700">
              Don’t have an account?{' '}
              <a href="/register" className="underline font-bold" style={{ color: deep }}>Create account</a>
            </p>
          </form>
        </div>
      </div>

      {/* Alto contraste para inputs */}
      <style jsx global>{`
        .field-input {
          border: 1px solid #94a3b8; /* slate-400 */
          background: #ffffff;
          color: #0f172a;             /* slate-900 */
          width: 100%;
          border-radius: 0.75rem;
          font-size: 15px;
          height: 44px;

          --fi-pl: 0.75rem; /* default 12px */
          --fi-pr: 0.75rem;
          padding: 0.625rem var(--fi-pr) 0.625rem var(--fi-pl);
        }
        .field-input::placeholder { color: #475569; }
        .field-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px #00B2CA22;
          border-color: #007A99;
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  // Suspense necesario para useSearchParams en Next 15 durante prerender
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6"
             style={{ background: 'linear-gradient(180deg, #f2f7f9 0%, #e9f2f5 100%)' }}>
          <div className="text-slate-600">Loading…</div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  )
}