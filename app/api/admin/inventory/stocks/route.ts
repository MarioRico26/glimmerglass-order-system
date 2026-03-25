// app/api/admin/inventory/stocks/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { AdminModule } from '@prisma/client'
function json(message: string, status = 400, extra?: any) {
  return NextResponse.json({ message, ...(extra ?? {}) }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(AdminModule.INVENTORY)
  if (!guard.ok) return json(guard.message, guard.status)

  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('itemId')
  const locationId = searchParams.get('locationId')
  const q = (searchParams.get('q') || '').trim() // sku/name contains

  const where: any = {}
  if (itemId) where.itemId = itemId
  if (locationId) where.locationId = locationId
  if (q) {
    where.item = {
      OR: [
        { sku: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    }
  }

  const stocks = await prisma.inventoryStock.findMany({
    where,
    orderBy: [{ locationId: 'asc' }, { itemId: 'asc' }],
    include: {
      item: { select: { id: true, sku: true, name: true, unit: true, minStock: true, active: true } },
      location: { select: { id: true, name: true, type: true, active: true } },
    },
  })

  return NextResponse.json(
    {
      stocks: stocks.map((s) => ({
        ...s,
        onHand: Number(s.onHand),
        item: s.item ? { ...s.item, minStock: Number(s.item.minStock) } : s.item,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
