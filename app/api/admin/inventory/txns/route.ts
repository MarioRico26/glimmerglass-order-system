// app/api/admin/inventory/txns/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { InventoryTxnType } from '@prisma/client'

function json(message: string, status = 400, extra?: any) {
  return NextResponse.json({ message, ...(extra ?? {}) }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function asInt(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : NaN
}

// GET: list txns (with filters)
export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return json(guard.message, guard.status)

  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('itemId')
  const locationId = searchParams.get('locationId')
  const orderId = searchParams.get('orderId')
  const type = searchParams.get('type') // IN/OUT/ADJUST
  const take = Math.min(200, Math.max(1, asInt(searchParams.get('take') || 50)))

  const where: any = {}
  if (itemId) where.itemId = itemId
  if (locationId) where.locationId = locationId
  if (orderId) where.orderId = orderId
  if (type) where.type = type

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

  return NextResponse.json({ txns }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * POST: create txn + update stock
 * Body:
 * { type: 'IN'|'OUT'|'ADJUST', qty: number, itemId: string, locationId: string, notes?: string, orderId?: string }
 *
 * Rules:
 * - IN: qty > 0, stock += qty
 * - OUT: qty > 0, stock -= qty (cannot go below 0)
 * - ADJUST: qty can be +/- (delta), stock += qty (cannot go below 0)
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return json(guard.message, guard.status)

  const body = await req.json().catch(() => null)

  const type = body?.type as InventoryTxnType | undefined
  const qty = asInt(body?.qty)
  const itemId = String(body?.itemId || '')
  const locationId = String(body?.locationId || '')
  const notes = body?.notes ? String(body.notes) : null
  const orderId = body?.orderId ? String(body.orderId) : null

  if (!type || !['IN', 'OUT', 'ADJUST'].includes(type)) return json('Invalid type', 400)
  if (!itemId) return json('itemId is required', 400)
  if (!locationId) return json('locationId is required', 400)
  if (!Number.isFinite(qty)) return json('qty must be a number', 400)

  if ((type === 'IN' || type === 'OUT') && qty <= 0) return json('qty must be > 0 for IN/OUT', 400)
  if (type === 'ADJUST' && qty === 0) return json('qty cannot be 0 for ADJUST', 400)

  const actorUserId = (guard.session?.user as any)?.id || null
  // Nota: si tu session no trae id, igual funciona porque actorUserId es opcional.

  const delta = type === 'IN' ? qty : type === 'OUT' ? -qty : qty

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Ensure item/location exist
      const [item, loc] = await Promise.all([
        tx.inventoryItem.findUnique({ where: { id: itemId }, select: { id: true, active: true } }),
        tx.inventoryLocation.findUnique({ where: { id: locationId }, select: { id: true, active: true } }),
      ])
      if (!item) throw Object.assign(new Error('Item not found'), { status: 404 })
      if (!loc) throw Object.assign(new Error('Location not found'), { status: 404 })
      if (!item.active) throw Object.assign(new Error('Item is inactive'), { status: 400 })
      if (!loc.active) throw Object.assign(new Error('Location is inactive'), { status: 400 })

      // Get current stock (or create 0)
      const stock = await tx.inventoryStock.upsert({
        where: { itemId_locationId: { itemId, locationId } },
        create: { itemId, locationId, onHand: 0 },
        update: {},
        select: { id: true, onHand: true },
      })

      const nextOnHand = stock.onHand + delta
      if (nextOnHand < 0) {
        throw Object.assign(new Error('Insufficient stock'), {
          status: 400,
          code: 'INSUFFICIENT_STOCK',
          onHand: stock.onHand,
          delta,
        })
      }

      const updatedStock = await tx.inventoryStock.update({
        where: { id: stock.id },
        data: { onHand: nextOnHand },
        select: { id: true, itemId: true, locationId: true, onHand: true },
      })

      const txn = await tx.inventoryTxn.create({
        data: {
          type,
          qty,
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

      return { txn, stock: updatedStock }
    })

    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    const status = e?.status || 500
    if (e?.code === 'INSUFFICIENT_STOCK') {
      return json(e.message || 'Insufficient stock', 400, { code: e.code, onHand: e.onHand, delta: e.delta })
    }
    console.error('POST /inventory/txns error:', e)
    return json(e?.message || 'Internal Server Error', status)
  }
}2