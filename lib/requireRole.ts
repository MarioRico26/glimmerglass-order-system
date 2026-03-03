// lib/requireRole.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export async function requireRole(roles: Array<'ADMIN' | 'SUPERADMIN'>) {
  const session = await getServerSession(authOptions)
  const role =
    session?.user && typeof session.user === 'object' && 'role' in session.user
      ? (session.user as { role?: unknown }).role
      : undefined
  if (typeof role !== 'string' || !roles.includes(role as 'ADMIN' | 'SUPERADMIN')) {
    throw Object.assign(new Error('Unauthorized'), { status: 403 })
  }
  return session
}
