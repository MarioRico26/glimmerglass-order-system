'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import BrandFooter from '@/components/BrandFooter'

type Props = {
  children: React.ReactNode
}

const HIDE_FOOTER_PREFIXES = ['/login', '/register', '/post-login']

export default function AppShell({ children }: Props) {
  const pathname = usePathname()

  const hideFooter = useMemo(() => {
    if (!pathname) return false
    return HIDE_FOOTER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }, [pathname])

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
      {!hideFooter ? <BrandFooter /> : null}
    </div>
  )
}
