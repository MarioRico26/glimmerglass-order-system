// app/api/superadmin/users/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function assertSuper(session: any) {
  const role = session?.user?.role
  if (role !== 'SUPERADMIN') {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    assertSuper(session)

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        approved: true,
        dealerId: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users }, { status: 200 })
  } catch (e: any) {
    const status = e?.status ?? 500
    const message = e?.message ?? 'Internal Server Error'
    return NextResponse.json({ message }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    assertSuper(session)

    const body = await req.json()
    const { email, password, role = 'ADMIN', approved = true } = body || {}

    if (!email || !password) {
      return NextResponse.json({ message: 'email and password are required' }, { status: 400 })
    }
    if (!['ADMIN', 'SUPERADMIN', 'DEALER'].includes(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ message: 'Email already exists' }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        role,
        approved: Boolean(approved),
      },
      select: {
        id: true, email: true, role: true, approved: true, dealerId: true,
      }
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/superadmin/users error:', e)
    const status = e?.status ?? 500
    const message = e?.message ?? 'Internal Server Error'
    return NextResponse.json({ message }, { status })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    assertSuper(session)

    const body = await req.json()
    const { id, approved, role, newPassword } = body || {}

    if (!id) {
      return NextResponse.json({ message: 'id is required' }, { status: 400 })
    }

    const data: any = {}
    if (typeof approved === 'boolean') data.approved = approved
    if (role) {
      if (!['ADMIN', 'SUPERADMIN', 'DEALER'].includes(role)) {
        return NextResponse.json({ message: 'Invalid role' }, { status: 400 })
      }
      data.role = role
    }
    if (newPassword) {
      data.password = await bcrypt.hash(newPassword, 10)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, role: true, approved: true, dealerId: true }
    })

    return NextResponse.json({ user }, { status: 200 })
  } catch (e: any) {
    console.error('PATCH /api/superadmin/users error:', e)
    const status = e?.status ?? 500
    const message = e?.message ?? 'Internal Server Error'
    return NextResponse.json({ message }, { status })
  }
}