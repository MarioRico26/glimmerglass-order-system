// glimmerglass-order-system/app/api/admin/inventory/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

function json(message: string, status = 400, extra?: any) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

function isAdmin(role: any) {
  return role === 'ADMIN' || role === 'SUPERADMIN'
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const items = await prisma.inventoryCategory.findMany({
      orderBy: { name: 'asc' }, // ✅ schema compatible
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
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const body = await req.json().catch(() => null)
    const name = (body?.name ?? '').toString().trim()

    if (!name) return json('name is required', 400)

    const created = await prisma.inventoryCategory.create({
      data: { name }, // ✅ no sortOrder (no existe en tu schema)
    })

    return NextResponse.json(created, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('POST /api/admin/inventory/categories error:', e)
    if (e?.code === 'P2002') return json('Category already exists', 400)
    return json('Internal server error', 500)
  }
}