import NextAuth, { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"

export const authOptions: AuthOptions = {
    pages: {
        signIn: "/login",
        // 👇 NO definimos "error" para que NextAuth NO redirija a /error
        // error: "/error"
    },
    session: { strategy: "jwt" },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const email = credentials?.email?.toLowerCase().trim()
                const password = credentials?.password || ""
                if (!email || !password) return null

                const user = await prisma.user.findUnique({
                    where: { email },
                    include: { dealer: true },
                })
                if (!user || !user.password) return null

                const ok = await compare(password, user.password)
                if (!ok) return null // => res.error = 'CredentialsSignin'

                // Dealer no aprobado: devolvemos error *controlado*.
                if (user.role === "DEALER" && !user.approved) {
                    // Con redirect:false en el frontend, res.error será 'PENDING_APPROVAL'
                    throw new Error("PENDING_APPROVAL")
                }

                return {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    approved: user.approved,
                    dealerId: user.dealerId ?? null,
                    dealerAgreementComplete: Boolean(user.dealer?.agreementSignedAt),
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = (user as any).id
                token.role = (user as any).role
                token.approved = (user as any).approved
                token.dealerId = (user as any).dealerId
                token.dealerAgreementComplete = (user as any).dealerAgreementComplete
            }
            return token
        },
        async session({ session, token }) {
            (session.user as any).id = token.id
            ;(session.user as any).role = token.role
            ;(session.user as any).approved = token.approved
            ;(session.user as any).dealerId = token.dealerId
            ;(session.user as any).dealerAgreementComplete = token.dealerAgreementComplete
            return session
        },
        // 👇 No uses callback signIn que retorne false o lance errores.
    },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }