// components/BrandFooter.tsx
'use client'

import Link from 'next/link'

export default function BrandFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="relative rounded-2xl border bg-white/82 backdrop-blur-xl shadow-[0_14px_34px_rgba(13,47,69,0.14)] overflow-hidden [border-color:var(--gg-border)]">
          {/* hairline gradient top */}
          <div
            className="h-1 w-full"
            style={{ backgroundImage: 'linear-gradient(90deg, var(--gg-aqua-600), var(--gg-navy-800))' }}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4">
            {/* Left: Powered by */}
            <div className="flex items-center gap-3">
              <span className="text-sm [color:var(--gg-muted)]">Powered by</span>

              {/* ByteNetworks pill */}
              <Link
                href="https://bytenetworks.net"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-full pl-2 pr-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 transition"
                aria-label="Visit ByteNetworks website"
              >
                {/* Simple mark */}
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-[11px] font-black shadow"
                  style={{ backgroundImage: 'linear-gradient(90deg, var(--gg-aqua-600), var(--gg-navy-800))' }}
                >
                  BN
                </span>
                <span className="text-sm font-semibold [font-family:var(--font-heading)] [color:var(--gg-navy-900)]">
                  ByteNetworks
                </span>
                <span
                  className="ml-1 block h-[2px] w-0 group-hover:w-8 rounded-full transition-all"
                  style={{ backgroundImage: 'linear-gradient(90deg, var(--gg-aqua-600), var(--gg-navy-800))' }}
                />
              </Link>
            </div>

            {/* Right: tagline */}
            <div className="text-xs text-center sm:text-right [color:var(--gg-muted)]">
              Design & Engineering by ByteNetworks • © {year}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
