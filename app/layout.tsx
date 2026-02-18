// app/layout.tsx
import './globals.css'
import { Providers } from './providers'
import AppShell from '@/components/AppShell'

export const metadata = {
  title: 'Glimmerglass Order System',
  description: 'Login powered by NextAuth',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--gg-canvas)] text-[var(--gg-ink)] antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
