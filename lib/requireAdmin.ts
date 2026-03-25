// lib/requireAdmin.ts
import { getServerSession } from 'next-auth'
import { AdminModule } from '@prisma/client'
import { authOptions } from '@/lib/authOptions'
import { requireAdminAccess } from '@/lib/adminAccess'

export async function requireAdmin(module?: AdminModule) {
  if (module) {
    try {
      const access = await requireAdminAccess(module)
      return { ok: true as const, session: access.session, access }
    } catch (e: any) {
      return {
        ok: false as const,
        status: e?.status ?? 500,
        message: e?.message ?? 'Forbidden',
      }
    }
  }

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
