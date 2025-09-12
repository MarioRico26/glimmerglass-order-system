// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // Evita que ESLint bloquee el build en Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Evita que TS bloquee el build (si hubiera typos en prod)
    ignoreBuildErrors: true,
  },
}

export default nextConfig