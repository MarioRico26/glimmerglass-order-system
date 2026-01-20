//glimmerglass-order-system/app/api/admin/inventory/locations/[id]/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { InventoryTxnType } from '@prisma/client'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

function normalizeQty(type: InventoryTxnType, qty: number) {
  // guardamos qty siempre POSITIVO, y el tipo define el signo lógico
  if (!Number.isFinite(qty) || qty <= 0) return null
  return Math.floor(qty)
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const { searchParams } = new URL(req.url)
  const take = Math.min(Math.max(Number(searchParams.get('take') || 200), 1), 500)

  const where: any = {}
  const itemId = searchParams.get('itemId')
  const locationId = searchParams.get('locationId')
  const orderId = searchParams.get('orderId')
  const type = searchParams.get('type')

  if (itemId) where.itemId = itemId
  if (locationId) where.locationId = locationId
  if (orderId) where.orderId = orderId
  if (type && Object.values(InventoryTxnType).includes(type as any)) where.type = type

  const txns = await prisma.inventoryTxn.findMany({
    where,
    take,
    orderBy: { createdAt: 'desc' },
    include: {
      item: { select: { id: true, sku: true, name: true, unit: true } },
      location: { select: { id: true, name: true, type: true } },
      actorUser: { select: { id: true, email: true } },
      order: { select: { id: true } },
    },
  })

  return json({ txns })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const actorUserId = (gate.session?.user as any)?.id || null

  const body = await req.json().catch(() => null)
  const type = (body?.type || '').toString().trim()
  const itemId = (body?.itemId || '').toString().trim()
  const locationId = (body?.locationId || '').toString().trim()
  const notes = body?.notes ? String(body.notes) : null
  const orderId = body?.orderId ? String(body.orderId) : null
  const qtyRaw = Number(body?.qty)

  if (!Object.values(InventoryTxnType).includes(type as any)) return json({ message: 'invalid type' }, 400)
  if (!itemId || !locationId) return json({ message: 'itemId and locationId are required' }, 400)

  const qty = normalizeQty(type as InventoryTxnType, qtyRaw)
  if (!qty) return json({ message: 'qty must be a positive integer' }, 400)

  const result = await prisma.$transaction(async (tx) => {
    // asegura stock row
    const stock = await tx.inventoryStock.upsert({
      where: { itemId_locationId: { itemId, locationId } },
      create: { itemId, locationId, onHand: 0 },
      update: {},
      select: { id: true, onHand: true },
    })

    // calcula delta
    const delta =
      type === 'IN' ? qty :
      type === 'OUT' ? -qty :
      // ADJUST: qty representa "nuevo onHand"? NO. aquí lo hacemos delta (positivo o negativo) usando body.delta
      // pero tú modelaste qty int, so para ADJUST lo usamos como delta y lo dejamos claro.
      type === 'ADJUST' ? (Number(body?.delta) || 0) : 0

    if (type === 'ADJUST') {
      const d = Number(body?.delta)
      if (!Number.isFinite(d) || d === 0) throw new Error('For ADJUST provide delta (non-zero number)')
    }

    const newOnHand = stock.onHand + delta
    if (newOnHand < 0) {
      throw new Error('Insufficient stock (would go below zero)')
    }

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: { onHand: newOnHand },
    })

    const txn = await tx.inventoryTxn.create({
      data: {
        type: type as InventoryTxnType,
        qty: qty, // siempre positivo
        notes,
        itemId,
        locationId,
        actorUserId,
        orderId,
      },
      include: {
        item: { select: { id: true, sku: true, name: true, unit: true } },
        location: { select: { id: true, name: true, type: true } },
        actorUser: { select: { id: true, email: true } },
        order: { select: { id: true } },
      },
    })

    return { txn, onHand: newOnHand }
  })

  return json(result, 201)
}