'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function ResetPasswordInner() {
  const searchParams = useSearchParams()
  const token = useMemo(() => (searchParams?.get('token') || '').trim(), [searchParams])
  const email = useMemo(
    () => (searchParams?.get('email') || '').trim().toLowerCase(),
    [searchParams]
  )

  const [validating, setValidating] = useState(true)
  const [validLink, setValidLink] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    const verify = async () => {
      if (!token || !email) {
        setValidating(false)
        setValidLink(false)
        setError('Invalid reset link.')
        return
      }

      try {
        setValidating(true)
        setError('')
        const url = `/api/auth/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
        const res = await fetch(url, { cache: 'no-store' })
        const data = (await res.json().catch(() => null)) as { valid?: boolean; message?: string } | null
        if (cancelled) return

        if (res.ok && data?.valid) {
          setValidLink(true)
          setError('')
        } else {
          setValidLink(false)
          setError(data?.message || 'Invalid or expired reset link.')
        }
      } catch {
        if (cancelled) return
        setValidLink(false)
        setError('Invalid or expired reset link.')
      } finally {
        if (!cancelled) setValidating(false)
      }
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [token, email])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validLink) return
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          password,
          confirmPassword,
        }),
      })
      const data = (await res.json().catch(() => null)) as { message?: string } | null
      if (!res.ok) throw new Error(data?.message || 'Reset failed')

      setMessage(data?.message || 'Your password has been reset successfully.')
      setValidLink(false)
      setPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="gg-shell-bg min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
        <h1 className="text-2xl font-black text-slate-900">Reset Password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Set a new password for your account.
        </p>

        {validating ? (
          <div className="mt-5 text-sm text-slate-600">Validating reset link…</div>
        ) : validLink ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-11 w-full rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 text-sm">
          <Link href="/login" className="text-sky-700 hover:underline font-semibold">
            Back to Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="gg-shell-bg min-h-screen flex items-center justify-center p-6">
          <div className="text-slate-600">Loading…</div>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  )
}
