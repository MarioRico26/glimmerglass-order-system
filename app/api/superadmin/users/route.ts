// app/api/superadmin/users/route.ts
export const runtime = 'nodejs' // <- MUY IMPORTANTE para bcryptjs

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { hash } from 'bcryptjs'

type Role = 'ADMIN' | 'SUPERADMIN'

function okRole(r: any): r is Role {
  return r === 'ADMIN' || r === 'SUPERADMIN'
}

export async function GET() {
  try {
    await requireRole(['SUPERADMIN'])
    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: { id: true, email: true, role: true, approved: true, dealerId: true },
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
    await requireRole(['SUPERADMIN'])

    const body = await req.json().catch(() => ({}))
    const email = (body?.email ?? '').trim().toLowerCase()
    const password = body?.password ?? ''
    const role = (body?.role ?? 'ADMIN') as Role
    const approved = typeof body?.approved === 'boolean' ? body.approved : true

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
    const user = await prisma.user.create({
      data: { email, password: hashed, role, approved },
      select: { id: true, email: true, role: true, approved: true },
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
    await requireRole(['SUPERADMIN'])
    const body = await req.json().catch(() => ({}))
    const id = body?.id as string | undefined
    if (!id) return NextResponse.json({ message: 'id requerido' }, { status: 400 })

    const data: any = {}

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

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, role: true, approved: true },
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