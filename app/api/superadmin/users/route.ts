// app/api/superadmin/users/route.ts
export const runtime = 'nodejs' // <- MUY IMPORTANTE para bcryptjs

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { hash } from 'bcryptjs'
import { AdminModule, ModuleAccessLevel } from '@prisma/client'
import { requireAdminAccess } from '@/lib/adminAccess'

type Role = 'ADMIN' | 'SUPERADMIN'

function okRole(r: any): r is Role {
  return r === 'ADMIN' || r === 'SUPERADMIN'
}

export async function GET() {
  try {
    await requireAdminAccess(AdminModule.USERS)
    await requireRole(['SUPERADMIN'])
    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        role: true,
        approved: true,
        dealerId: true,
        factoryAccesses: {
          select: {
            factoryLocationId: true,
            factoryLocation: { select: { id: true, name: true } },
          },
        },
        moduleAccesses: {
          select: {
            module: true,
            accessLevel: true,
          },
          orderBy: { module: 'asc' },
        },
      },
    })
    return NextResponse.json({ users })
  } catch (e: any) {
    const status = e?.status ?? 500
    const message = e?.message ?? 'Internal server error'
    return NextResponse.json({ message }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.USERS)
    await requireRole(['SUPERADMIN'])

    const body = await req.json().catch(() => ({}))
    const email = (body?.email ?? '').trim().toLowerCase()
    const password = body?.password ?? ''
    const role = (body?.role ?? 'ADMIN') as Role
    const approved = typeof body?.approved === 'boolean' ? body.approved : true
    const factoryAccessIds = Array.isArray(body?.factoryAccessIds) ? body.factoryAccessIds : []
    const moduleAccess = Array.isArray(body?.moduleAccess) ? body.moduleAccess : []

    if (!email || !password) {
      return NextResponse.json({ message: 'email y password son requeridos' }, { status: 400 })
    }
    if (!okRole(role)) {
      return NextResponse.json({ message: 'role inválido (ADMIN | SUPERADMIN)' }, { status: 400 })
    }

    // Evita duplicados por adelantado
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return NextResponse.json({ message: 'Email ya existe' }, { status: 409 })
    }

    const hashed = await hash(password, 10)
    const validFactoryIds = factoryAccessIds.filter((id: any) => typeof id === 'string' && id.length > 5)
    const validModuleAccess = moduleAccess.filter(
      (entry: any) =>
        entry &&
        typeof entry.module === 'string' &&
        Object.values(AdminModule).includes(entry.module) &&
        (!entry.accessLevel || Object.values(ModuleAccessLevel).includes(entry.accessLevel))
    )
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        role,
        approved,
        factoryAccesses: validFactoryIds.length
          ? {
              createMany: {
                data: validFactoryIds.map((factoryLocationId: string) => ({ factoryLocationId })),
              },
            }
          : undefined,
        moduleAccesses: validModuleAccess.length
          ? {
              createMany: {
                data: validModuleAccess.map((entry: any) => ({
                  module: entry.module,
                  accessLevel: entry.accessLevel || ModuleAccessLevel.VIEW,
                })),
              },
            }
          : undefined,
      },
      select: {
        id: true,
        email: true,
        role: true,
        approved: true,
        dealerId: true,
        factoryAccesses: {
          select: {
            factoryLocationId: true,
            factoryLocation: { select: { id: true, name: true } },
          },
        },
        moduleAccesses: {
          select: {
            module: true,
            accessLevel: true,
          },
          orderBy: { module: 'asc' },
        },
      },
    })
    return NextResponse.json({ user }, { status: 201 })
  } catch (e: any) {
    // Prisma unique violation
    if (e?.code === 'P2002') {
      return NextResponse.json({ message: 'Email ya existe (P2002)' }, { status: 409 })
    }
    const status = e?.status ?? 500
    const message = e?.message ?? 'Internal server error'
    console.error('POST /api/superadmin/users error:', e)
    return NextResponse.json({ message }, { status })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.USERS)
    await requireRole(['SUPERADMIN'])
    const body = await req.json().catch(() => ({}))
    const id = body?.id as string | undefined
    if (!id) return NextResponse.json({ message: 'id requerido' }, { status: 400 })

    const data: any = {}
    const replaceFactories = Array.isArray(body?.factoryAccessIds)
    const replaceModules = Array.isArray(body?.moduleAccess)

    if (typeof body?.approved === 'boolean') data.approved = body.approved
    if (body?.role) {
      if (!okRole(body.role)) {
        return NextResponse.json({ message: 'role inválido (ADMIN | SUPERADMIN)' }, { status: 400 })
      }
      data.role = body.role
    }
    if (body?.password) {
      data.password = await hash(body.password, 10)
    }

    const validFactoryIds = replaceFactories
      ? body.factoryAccessIds.filter((factoryId: any) => typeof factoryId === 'string' && factoryId.length > 5)
      : []
    const validModuleAccess = replaceModules
      ? body.moduleAccess.filter(
          (entry: any) =>
            entry &&
            typeof entry.module === 'string' &&
            Object.values(AdminModule).includes(entry.module) &&
            (!entry.accessLevel || Object.values(ModuleAccessLevel).includes(entry.accessLevel))
        )
      : []

    const user = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.user.update({
          where: { id },
          data,
        })
      }

      if (replaceFactories) {
        await tx.userFactoryAccess.deleteMany({ where: { userId: id } })
        if (validFactoryIds.length) {
          await tx.userFactoryAccess.createMany({
            data: validFactoryIds.map((factoryLocationId: string) => ({ userId: id, factoryLocationId })),
          })
        }
      }

      if (replaceModules) {
        await tx.userModuleAccess.deleteMany({ where: { userId: id } })
        if (validModuleAccess.length) {
          await tx.userModuleAccess.createMany({
            data: validModuleAccess.map((entry: any) => ({
              userId: id,
              module: entry.module,
              accessLevel: entry.accessLevel || ModuleAccessLevel.VIEW,
            })),
          })
        }
      }

      return tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          role: true,
          approved: true,
          dealerId: true,
          factoryAccesses: {
            select: {
              factoryLocationId: true,
              factoryLocation: { select: { id: true, name: true } },
            },
          },
          moduleAccesses: {
            select: {
              module: true,
              accessLevel: true,
            },
            orderBy: { module: 'asc' },
          },
        },
      })
    })
    return NextResponse.json({ user })
  } catch (e: any) {
    const status = e?.status ?? 500
    const message = e?.message ?? 'Internal server error'
    console.error('PATCH /api/superadmin/users error:', e)
    return NextResponse.json({ message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.USERS)
    await requireRole(['SUPERADMIN'])
    const body = await req.json().catch(() => ({}))
    const id = body?.id as string | undefined
    if (!id) return NextResponse.json({ message: 'id requerido' }, { status: 400 })

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = e?.status ?? 500
    const message = e?.message ?? 'Internal server error'
    console.error('DELETE /api/superadmin/users error:', e)
    return NextResponse.json({ message }, { status })
  }
}
