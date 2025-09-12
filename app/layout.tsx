// app/layout.tsx
import './globals.css'
import { Providers } from './providers'
import BrandFooter from '@/components/BrandFooter'

export const metadata = {
  title: 'Glimmerglass Order System',
  description: 'Login powered by NextAuth',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F7FBFD]">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <main className="flex-1">{children}</main>
            <BrandFooter />
          </div>
        </Providers>
      </body>
    </html>
  )
}