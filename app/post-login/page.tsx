// app/post-login/page.tsx
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/authOptions' // usa el tuyo correcto

export const dynamic = 'force-dynamic'

export default async function PostLoginPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const u = session.user as any

  if (u.role === 'SUPERADMIN') {
    redirect('/superadmin')
  }
  if (u.role === 'ADMIN') {
    redirect('/admin')
  }
  if (u.role === 'DEALER') {
    if (!u.approved) {
      // no autorizado todavía → vuelve a login con mensaje claro
      redirect('/login?error=PENDING_APPROVAL')
    }
    // si el token aún no trae dealerAgreementComplete, igual
    // el GuardAgreement del layout nos mandará a /dealer/agreement
    redirect('/dealer')
  }

  redirect('/') // fallback
}