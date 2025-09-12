// app/page.tsx
'use client'

import { LogIn, UserPlus } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const aqua = '#00B2CA'
  const deep = '#007A99'
  const mist = '#E6F7FA'

  return (
    <main
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-6"
      style={{
        background:
          `radial-gradient(1100px 700px at 80% 0%, ${mist} 0%, transparent 60%),
           radial-gradient(800px 500px at 10% 90%, rgba(0,178,202,0.10) 0%, transparent 60%),
           linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)`,
      }}
    >
      {/* spotlight */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-multiply opacity-70"
        style={{
          background: `radial-gradient(600px 300px at 50% 0%, rgba(0,178,202,.2), transparent 60%)`,
        }}
      />

      {/* card */}
      <div className="relative w-full max-w-4xl">
        <div
          className="absolute -inset-[1.5px] rounded-[32px] blur-sm"
          style={{ background: `linear-gradient(120deg, ${aqua}, ${deep})` }}
        />
        <div className="relative rounded-[32px] bg-white/80 backdrop-blur-xl border border-white shadow-[0_24px_60px_rgba(0,122,153,0.15)] overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Left: brand/hero */}
            <div className="p-8 md:p-10 bg-gradient-to-b from-white/40 to-white/10">
              <div className="inline-flex items-center gap-2 text-sm font-medium rounded-full px-3 py-1 border border-slate-200 bg-white/70 text-slate-700">
                Glimmerglass Dealer Portal
              </div>

              <h1 className="mt-6 text-4xl md:text-5xl font-black leading-tight"
                  style={{ color: deep }}>
                Build faster. <br /> Track smarter.
              </h1>

             

              <ul className="mt-6 space-y-2 text-slate-700/90">
                <li>• Realtime order status & history</li>
                <li>• Media uploads & approvals</li>
                <li>• Role-based access and security</li>
              </ul>

              <div className="mt-8 grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 h-12 rounded-2xl font-semibold text-white shadow-lg transition-transform active:scale-[0.99]"
                  style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
                >
                  <LogIn size={18} />
                  Sign in
                </Link>

                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 h-12 rounded-2xl font-semibold border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition"
                >
                  <UserPlus size={18} />
                  Create account
                </Link>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                By continuing you agree to our Terms and Privacy Policy.
              </p>
            </div>

            {/* Right: corporate preview (minimal + animado) */}
            <div className="relative hidden md:flex items-center justify-center p-10 bg-gradient-to-b from-white/40 to-white/10">
              {/* halo conic muy sutil */}
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <div
                  className="w-[420px] h-[420px] rounded-full"
                  style={{
                    background: `conic-gradient(from 0deg, ${aqua}, ${deep}, ${aqua})`,
                    animation: 'home_spin 24s linear infinite'
                  }}
                />
              </div>

              {/* tarjeta con gráfico */}
              <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-md shadow-lg p-6 animate-home_fade">
                <h3 className="text-lg font-bold mb-4" style={{ color: deep }}>
                  Business Insights
                </h3>

                {/* mini chart de barras */}
                <div className="space-y-4">
                  {[
                    { label: 'Orders', value: 80 },
                    { label: 'Production', value: 65 },
                    { label: 'Deliveries', value: 45 },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>{item.label}</span>
                        <span>{item.value}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full will-change-[width]"
                          style={{
                            backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})`,
                            width: 0,
                            animation: `home_fill 1.2s ease forwards`,
                            animationDelay: `${idx * 180}ms`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* líneas KPI */}
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  {[
                    { k: 'SLAs', v: '98%' },
                    { k: 'On-time', v: '94%' },
                    { k: 'CSAT', v: '4.8' },
                  ].map((m, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white py-2">
                      <div className="text-xs text-slate-500">{m.k}</div>
                      <div className="text-base font-bold text-slate-900">{m.v}</div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Real-time overview of your operations.
                </p>
              </div>
            </div>
          </div>

          {/* footer stripe */}
          <div className="h-2 w-full"
               style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }} />
        </div>
      </div>

      {/* estilos globales (unificado para evitar nested styled-jsx) */}
      <style jsx global>{`
        @keyframes home_spin {
          to { transform: rotate(360deg); }
        }
        @keyframes home_fade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes home_fill {
          to { width: var(--finalWidth, 100%); }
        }
        /* Porcentajes finales de las barras */
        .space-y-4 > div:nth-child(1) .h-full { --finalWidth: 80%; }
        .space-y-4 > div:nth-child(2) .h-full { --finalWidth: 65%; }
        .space-y-4 > div:nth-child(3) .h-full { --finalWidth: 45%; }
      `}</style>
    </main>
  )
}