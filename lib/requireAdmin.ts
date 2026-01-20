// lib/requireAdmin.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  const email = (session?.user as any)?.email

  if (!email) {
    return { ok: false as const, status: 401, message: 'Unauthorized' }
  }
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    return { ok: false as const, status: 403, message: 'Forbidden' }
  }

  return { ok: true as const, session }
}