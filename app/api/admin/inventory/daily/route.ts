// app/api/admin/inventory/daily/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('locationId')
  const dateParam = searchParams.get('date')

  if (!locationId || !dateParam) {
    return json({ message: 'locationId and date are required' }, 400)
  }

  const date = new Date(dateParam + 'T00:00:00.000Z')

  // 1. Location
  const location = await prisma.inventoryLocation.findUnique({
    where: { id: locationId },
  })
  if (!location) return json({ message: 'Location not found' }, 404)

  // 2. Items + Category + Stock
  const items = await prisma.inventoryItem.findMany({
    where: { active: true },
    include: {
      category: true,
      stocks: {
        where: { locationId },
      },
    },
    orderBy: [
      { category: { name: 'asc' } },
      { name: 'asc' },
    ],
  })

  // 3. Reorder sheet (create if missing)
  const sheet = await prisma.inventoryReorderSheet.upsert({
    where: {
      locationId_date: {
        locationId,
        date,
      },
    },
    update: {},
    create: {
      locationId,
      date,
    },
    include: {
      lines: true,
    },
  })

  const linesByItem = Object.fromEntries(
    sheet.lines.map(l => [l.itemId, l.qtyToOrder])
  )

  const rows = items.map(item => {
    const stock = item.stocks[0]?.onHand ?? 0

    return {
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      category: item.category?.name ?? 'UNCATEGORIZED',
      onHand: stock,
      qtyToOrder: linesByItem[item.id] ?? 0,
    }
  })

  return json({
    location: { id: location.id, name: location.name },
    date: dateParam,
    rows,
  })
}