// app/api/admin/inventory/reorder-lines/route.ts
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

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const body = await req.json().catch(() => null)
  const { locationId, date, itemId, qtyToOrder } = body || {}

  if (!locationId || !date || !itemId || !Number.isInteger(qtyToOrder)) {
    return json({ message: 'invalid payload' }, 400)
  }

  const sheet = await prisma.inventoryReorderSheet.upsert({
    where: {
      locationId_date: {
        locationId,
        date: new Date(date + 'T00:00:00.000Z'),
      },
    },
    update: {},
    create: {
      locationId,
      date: new Date(date + 'T00:00:00.000Z'),
    },
  })

  const line = await prisma.inventoryReorderLine.upsert({
    where: {
      sheetId_itemId: {
        sheetId: sheet.id,
        itemId,
      },
    },
    update: {
      qtyToOrder,
    },
    create: {
      sheetId: sheet.id,
      itemId,
      qtyToOrder,
    },
  })

  return json({ ok: true, line })
}