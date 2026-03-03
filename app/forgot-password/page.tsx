'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || 'Request failed')
      setMessage(
        data?.message ||
          'If the email exists in our system, password reset instructions will be sent shortly.'
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="gg-shell-bg min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
        <h1 className="text-2xl font-black text-slate-900">Forgot Password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter your account email and we will process a password reset request.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </div>

          {message ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Sending…' : 'Send Reset Request'}
          </button>
        </form>

        <div className="mt-4 text-sm">
          <Link href="/login" className="text-sky-700 hover:underline font-semibold">
            Back to Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
