// app/api/admin/inventory/daily/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return NextResponse.json({ message: gate.message }, { status: gate.status })
  }

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('locationId')
  const dateStr = searchParams.get('date')

  if (!locationId || !dateStr) {
    return NextResponse.json(
      { message: 'locationId and date are required' },
      { status: 400 }
    )
  }

  const date = new Date(dateStr + 'T00:00:00.000Z')

  // get or create reorder sheet
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
  })

  const items = await prisma.inventoryItem.findMany({
    where: { active: true },
    include: {
      category: true,
      stocks: {
        where: { locationId },
      },
      reorderLines: {
        where: { sheetId: sheet.id },
      },
    },
    orderBy: [
      { category: { name: 'asc' } },
      { name: 'asc' },
    ],
  })

  // Agrupar igual que el Excel
  const categories: Record<string, any[]> = {}

  for (const item of items) {
    const categoryName = item.category?.name ?? 'UNCATEGORIZED'

    if (!categories[categoryName]) {
      categories[categoryName] = []
    }

    categories[categoryName].push({
      id: item.id,
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      onHand: item.stocks[0]?.onHand ?? 0,
      qtyToOrder: item.reorderLines[0]?.qtyToOrder ?? 0,
    })
  }

  return NextResponse.json({
    locationId,
    date: dateStr,
    categories,
  })
}