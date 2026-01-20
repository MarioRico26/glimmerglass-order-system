// glimmerglass-order-system/app/api/admin/inventory/reorder-sheets/route.ts
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

// Acepta "2026-01-12" o ISO completo, lo normaliza a 00:00:00Z.
function normalizeDateISO(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(+d)) return null
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)).toISOString()
  return iso
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const { searchParams } = new URL(req.url)
    const locationId = (searchParams.get('locationId') || '').trim()
    const date = (searchParams.get('date') || '').trim() // yyyy-mm-dd o ISO

    const where: any = {}
    if (locationId) where.locationId = locationId
    if (date) {
      const iso = normalizeDateISO(date)
      if (!iso) return json('Invalid date', 400)
      where.date = new Date(iso)
    }

    const items = await prisma.inventoryReorderSheet.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], // ✅ createdAt existe en Sheet
      include: {
        location: { select: { id: true, name: true, type: true } },
      },
      take: 200,
    })

    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/admin/inventory/reorder-sheets error:', e)
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
    const locationId = (body?.locationId ?? '').toString().trim()
    const dateStr = (body?.date ?? '').toString().trim() // yyyy-mm-dd recomendado

    if (!locationId) return json('locationId is required', 400)
    if (!dateStr) return json('date is required', 400)

    const iso = normalizeDateISO(dateStr)
    if (!iso) return json('Invalid date', 400)
    const date = new Date(iso)

    // get-or-create por (locationId, date)
    const existing = await prisma.inventoryReorderSheet.findFirst({
      where: { locationId, date },
      include: { location: { select: { id: true, name: true, type: true } } },
    })
    if (existing) return NextResponse.json(existing, { headers: { 'Cache-Control': 'no-store' } })

    const created = await prisma.inventoryReorderSheet.create({
      data: {
        locationId,
        date,
        // ✅ NO createdByUserId (no existe en tu schema)
      },
      include: { location: { select: { id: true, name: true, type: true } } },
    })

    return NextResponse.json(created, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('POST /api/admin/inventory/reorder-sheets error:', e)
    if (e?.code === 'P2002') return json('Sheet already exists for that location/date', 400)
    return json('Internal server error', 500)
  }
}