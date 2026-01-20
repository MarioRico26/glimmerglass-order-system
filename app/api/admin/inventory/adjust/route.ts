// app/api/admin/inventory/adjust/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { InventoryTxnType } from '@prisma/client'

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
  const { itemId, locationId, newOnHand } = body || {}

  if (!itemId || !locationId || !Number.isInteger(newOnHand)) {
    return json({ message: 'itemId, locationId, newOnHand required' }, 400)
  }

  const result = await prisma.$transaction(async tx => {
    const stock = await tx.inventoryStock.upsert({
      where: {
        itemId_locationId: { itemId, locationId },
      },
      create: {
        itemId,
        locationId,
        onHand: newOnHand,
      },
      update: {
        onHand: newOnHand,
      },
    })

    await tx.inventoryTxn.create({
      data: {
        type: InventoryTxnType.ADJUST,
        qty: Math.abs(newOnHand),
        itemId,
        locationId,
        notes: 'Daily inventory adjustment',
        actorUserId: (gate.session?.user as any)?.id,
      },
    })

    return stock
  })

  return json({ ok: true, stock: result })
}