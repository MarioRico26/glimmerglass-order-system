// lib/authOptions.ts
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'

/**
 * En el JWT guardamos info clave para rutas:
 * - role, dealerId
 * - approved (para bloquear login si aún no lo aprueban)
 * - dealerAgreementComplete (si ya subió PDF o firmó)
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = (credentials?.email || '').toString().toLowerCase().trim()
        const password = (credentials?.password || '').toString()

        const user = await prisma.user.findUnique({
          where: { email },
          include: { dealer: true },
        })
        if (!user) {
          throw new Error('INVALID_CREDENTIALS')
        }

        const ok = await compare(password, user.password)
        if (!ok) {
          throw new Error('INVALID_CREDENTIALS')
        }

        // 🔒 Bloquear si no está aprobado
        if (user.role === 'DEALER' && !user.approved) {
          // Propagamos un error específico para que la UI muestre “Pending approval”
          throw new Error('PENDING_APPROVAL')
        }

        // Dealer: calcular si ya cumplió acuerdo (pdf o firma)
        const dealerAgreementComplete =
          !!user.dealer?.agreementUrl || !!(user as any).dealer?.agreementSignedAt

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          dealerId: user.dealerId ?? null,
          approved: user.approved,
          dealerAgreementComplete,
        } as any
      },
    }),
  ],

  pages: {
    signIn: '/login', // tu página de login
  },

  callbacks: {
    async jwt({ token, user }) {
      // En primer login “user” viene con los campos de authorize
      if (user) {
        token.role = (user as any).role
        token.dealerId = (user as any).dealerId ?? null
        token.approved = (user as any).approved ?? true
        token.dealerAgreementComplete = (user as any).dealerAgreementComplete ?? false
      } else {
        // En renovaciones, refrescamos flags sensibles para no depender del primer login
        if (token?.email) {
          const db = await prisma.user.findUnique({
            where: { email: token.email as string },
            include: { dealer: true },
          })
          if (db) {
            token.role = db.role
            token.dealerId = db.dealerId ?? null
            token.approved = db.approved
            token.dealerAgreementComplete = !!db.dealer?.agreementUrl || !!(db as any).dealer?.agreementSignedAt
          }
        }
      }
      return token
    },

    async session({ session, token }) {
      // Enviar al cliente lo que necesitamos
      ;(session as any).user = {
        ...session.user,
        role: token.role,
        dealerId: token.dealerId ?? null,
        approved: token.approved,
        dealerAgreementComplete: token.dealerAgreementComplete,
      }
      return session
    },

    /**
     * Redirecciones post-auth:
     * - DEALER sin acuerdo => /dealer/agreement
     * - DEALER con acuerdo => /dealer
     * - ADMIN/SUPERADMIN => /admin
     */
    async redirect({ url, baseUrl }) {
      // Si viene desde /api/auth/signin con callbackUrl… respetamos dominios propios
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith('/')) return `${baseUrl}${url}`
      return baseUrl
    },
  },
}