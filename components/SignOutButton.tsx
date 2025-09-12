'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

type Props = {
  label?: string
  className?: string
  variant?: 'icon' | 'full'
}

export default function SignOutButton({ label = 'Sign out', className = '', variant = 'full' }: Props) {
  const handle = () => signOut({ callbackUrl: '/login', redirect: true })
  if (variant === 'icon') {
    return (
      <button
        onClick={handle}
        title={label}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 border border-slate-200 hover:bg-slate-50 ${className}`}
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    )
  }
  return (
    <button
      onClick={handle}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 ${className}`}
    >
      <LogOut className="h-4 w-4" />
      {label}
    </button>
  )
}