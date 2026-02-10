// glimmerglass-order-system/app/api/admin/inventory/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

function json(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

function isAdmin(role: unknown) {
  return role === 'ADMIN' || role === 'SUPERADMIN'
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as { email?: string | null; role?: string } | undefined
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const items = await prisma.inventoryCategory.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/admin/inventory/categories error:', e)
    return json('Internal server error', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as { email?: string | null; role?: string } | undefined
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const body = await req.json().catch(() => null)
    const name = (body?.name ?? '').toString().trim()
    const active = body?.active === undefined ? true : Boolean(body.active)
    const sortOrderRaw = body?.sortOrder
    const sortOrder = sortOrderRaw === undefined ? 9999 : Number(sortOrderRaw)

    if (!name) return json('name is required', 400)
    if (!Number.isFinite(sortOrder)) return json('sortOrder must be a number', 400)

    const created = await prisma.inventoryCategory.create({
      data: { name, active, sortOrder },
    })

    return NextResponse.json(created, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    console.error('POST /api/admin/inventory/categories error:', e)
    const code =
      typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : ''
    if (code === 'P2002') return json('Category already exists', 400)
    return json('Internal server error', 500)
  }
}
