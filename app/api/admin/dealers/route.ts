// app/api/admin/dealers/route.ts
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { hash } from 'bcryptjs'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'SUPERADMIN'].includes(session.user?.role as any)) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }
}

export async function GET() {
  try {
    await requireAdmin()

    const dealers = await prisma.dealer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        agreementUrl: true,
        createdAt: true,
        User: {
          select: { approved: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const payload = dealers.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone ?? '',
      city: d.city ?? '',
      state: d.state ?? '',
      approved: d.User?.approved ?? false,
      agreementUrl: d.agreementUrl ?? null,
    }))

    return NextResponse.json(payload, { status: 200 })
  } catch (error: any) {
    if (error?.status) {
      return NextResponse.json({ message: error.message || 'Unauthorized' }, { status: error.status })
    }
    console.error('Error fetching dealers:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json().catch(() => null) as {
      name?: string
      email?: string
      password?: string
      phone?: string
      address?: string
      city?: string
      state?: string
      approved?: boolean
      createLogin?: boolean
    } | null

    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const phone = String(body?.phone || '').trim()
    const address = String(body?.address || '').trim()
    const city = String(body?.city || '').trim()
    const state = String(body?.state || '').trim()
    const createLogin = body?.createLogin === undefined ? true : Boolean(body.createLogin)
    const approved = body?.approved === undefined ? true : Boolean(body.approved)

    if (!name || !email || !phone || !address || !city || !state) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 })
    }
    if (createLogin && password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const [existingDealer, existingUser] = await Promise.all([
      prisma.dealer.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { email } }),
    ])
    if (existingDealer) {
      return NextResponse.json({ message: 'A dealer with this email already exists' }, { status: 409 })
    }
    if (createLogin && existingUser) {
      return NextResponse.json({ message: 'This email is already registered as a user' }, { status: 409 })
    }

    const created = await prisma.$transaction(async (tx) => {
      const dealer = await tx.dealer.create({
        data: {
          name,
          email,
          phone,
          address,
          city,
          state,
        },
      })

      if (createLogin) {
        const hashedPassword = await hash(password, 10)
        await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            role: 'DEALER',
            approved,
            dealerId: dealer.id,
          },
        })
      }

      return dealer
    })

    return NextResponse.json({ ok: true, dealerId: created.id, loginCreated: createLogin }, { status: 201 })
  } catch (error: any) {
    if (error?.status) {
      return NextResponse.json({ message: error.message || 'Unauthorized' }, { status: error.status })
    }
    console.error('Error creating dealer:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
