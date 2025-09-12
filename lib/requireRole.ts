// lib/requireRole.ts
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export async function requireRole(roles: Array<'ADMIN' | 'SUPERADMIN'>) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!role || !roles.includes(role)) {
    throw Object.assign(new Error('Unauthorized'), { status: 403 })
  }
  return session
}