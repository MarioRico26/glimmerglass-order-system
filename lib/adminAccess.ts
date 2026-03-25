import { getServerSession } from 'next-auth'
import { AdminModule, ModuleAccessLevel, Role } from '@prisma/client'

import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

type AdminRole = Role.ADMIN | Role.SUPERADMIN

export const ADMIN_MODULE_VALUES: AdminModule[] = [
  AdminModule.DASHBOARD,
  AdminModule.ORDER_LIST,
  AdminModule.NEW_ORDER,
  AdminModule.PRODUCTION_SCHEDULE,
  AdminModule.SHIP_SCHEDULE,
  AdminModule.POOL_STOCK,
  AdminModule.POOL_CATALOG,
  AdminModule.WORKFLOW_REQUIREMENTS,
  AdminModule.INVENTORY,
  AdminModule.DEALERS,
  AdminModule.USERS,
]

export type AdminAccessContext = {
  session: Awaited<ReturnType<typeof getServerSession>>
  userId: string
  email: string
  role: AdminRole
  isSuperadmin: boolean
  legacyFullAccess: boolean
  allowedFactoryIds: string[] | null
  allowedModules: AdminModule[] | null
}

function hasAdminRole(role: unknown): role is AdminRole {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

export async function requireAdminAccess(module?: AdminModule): Promise<AdminAccessContext> {
  const session = await getServerSession(authOptions)
  const email = (session?.user as any)?.email as string | undefined
  const role = (session?.user as any)?.role as unknown

  if (!email) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }
  if (!hasAdminRole(role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      factoryAccesses: { select: { factoryLocationId: true } },
      moduleAccesses: { select: { module: true, accessLevel: true } },
    },
  })

  if (!dbUser || !hasAdminRole(dbUser.role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }

  if (dbUser.role === Role.SUPERADMIN) {
    return {
      session,
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      isSuperadmin: true,
      legacyFullAccess: false,
      allowedFactoryIds: null,
      allowedModules: null,
    }
  }

  const hasFactoryRules = dbUser.factoryAccesses.length > 0
  const hasModuleRules = dbUser.moduleAccesses.length > 0
  const legacyFullAccess = !hasFactoryRules && !hasModuleRules

  if (module && hasModuleRules) {
    const moduleAccess = dbUser.moduleAccesses.find((entry) => entry.module === module)
    if (!moduleAccess || ![ModuleAccessLevel.VIEW, ModuleAccessLevel.EDIT].includes(moduleAccess.accessLevel)) {
      throw Object.assign(new Error('Forbidden'), { status: 403 })
    }
  }

  return {
    session,
    userId: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    isSuperadmin: false,
    legacyFullAccess,
    allowedFactoryIds: hasFactoryRules ? dbUser.factoryAccesses.map((entry) => entry.factoryLocationId) : null,
    allowedModules: hasModuleRules ? dbUser.moduleAccesses.map((entry) => entry.module) : null,
  }
}

export function assertFactoryAccess(
  access: Pick<AdminAccessContext, 'isSuperadmin' | 'allowedFactoryIds'>,
  factoryLocationId: string | null | undefined
) {
  if (access.isSuperadmin || access.allowedFactoryIds === null) return
  if (!factoryLocationId || !access.allowedFactoryIds.includes(factoryLocationId)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
}

export function scopedFactoryWhere(
  access: Pick<AdminAccessContext, 'isSuperadmin' | 'allowedFactoryIds'>,
  field = 'factoryLocationId'
) {
  if (access.isSuperadmin || access.allowedFactoryIds === null) return {}
  return {
    [field]: {
      in: access.allowedFactoryIds,
    },
  }
}
