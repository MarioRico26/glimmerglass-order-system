import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'

import { ADMIN_MODULE_VALUES, requireAdminAccess } from '@/lib/adminAccess'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function parseModule(raw: string | null): AdminModule | undefined {
  if (!raw) return undefined
  return ADMIN_MODULE_VALUES.includes(raw as AdminModule) ? (raw as AdminModule) : undefined
}

export async function GET(request: NextRequest) {
  try {
    const module = parseModule(request.nextUrl.searchParams.get('module'))
    const access = await requireAdminAccess(module)

    const factories =
      access.allowedFactoryIds === null
        ? []
        : await prisma.factoryLocation.findMany({
            where: { id: { in: access.allowedFactoryIds } },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })

    const effectiveModules = access.allowedModules ?? ADMIN_MODULE_VALUES

    return NextResponse.json({
      role: access.role,
      isSuperadmin: access.isSuperadmin,
      legacyFullAccess: access.legacyFullAccess,
      allFactories: access.allowedFactoryIds === null,
      allowedFactoryIds: access.allowedFactoryIds,
      factories,
      allModules: access.allowedModules === null,
      allowedModules: access.allowedModules,
      effectiveModules,
    })
  } catch (e: unknown) {
    const message =
      typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string'
        ? e.message
        : 'Internal Server Error'
    const status =
      typeof e === 'object' && e !== null && 'status' in e && typeof e.status === 'number'
        ? e.status
        : 500
    return NextResponse.json({ message }, { status })
  }
}
