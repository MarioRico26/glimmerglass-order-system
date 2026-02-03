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

function normalizeDateISO(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(+d)) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0))
}

type Row = {
  itemId: string
  sku: string
  item: string
  unit: string
  minStock: number
  createdAt: string
  category: string
  onHand: number
  qtyToOrder: number
}

const CATEGORY_ORDER = [
  'PIGMENT',
  'RESIN',
  'CHOP/ GUN ROVING',
  'CHOP/GUN ROVING',
  'ACETONE',
  'MOLD RELEASE',
  'BUFFING COMPOUND',
  'CATALYST',
  'HONEYCOMB',
  'COMBO MAT',
  'GELCOAT',
]

function categoryRank(name: string) {
  const idx = CATEGORY_ORDER.indexOf(name.trim().toUpperCase())
  return idx === -1 ? 999 : idx
}

/**
 * GET /api/admin/inventory/daily?locationId=<uuid>&date=YYYY-MM-DD
 * ✅ Histórico real por día: onHand + qtyToOrder salen del sheet del día
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  try {
    const { searchParams } = new URL(req.url)
    const locationId = (searchParams.get('locationId') || '').trim()
    const dateStr = (searchParams.get('date') || '').trim()

    if (!locationId) return json({ message: 'locationId is required' }, 400)
    if (!dateStr) return json({ message: 'date is required (YYYY-MM-DD)' }, 400)

    const date = normalizeDateISO(dateStr)
    if (!date) return json({ message: 'invalid date' }, 400)

    const location = await prisma.inventoryLocation.findUnique({
      where: { id: locationId },
      select: { id: true, name: true, type: true, active: true },
    })
    if (!location) return json({ message: 'location not found' }, 404)

    // Sheet (día + location) get-or-create
    const sheet = await prisma.inventoryReorderSheet.upsert({
      where: { locationId_date: { locationId, date } },
      create: { locationId, date },
      update: {},
      select: { id: true, locationId: true, date: true },
    })

    const [items, categories, lines] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { active: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          minStock: true,
          createdAt: true,
          categoryId: true,
        },
      }),
      prisma.inventoryCategory.findMany({
        where: { active: true },
        select: { id: true, name: true },
      }),
      prisma.inventoryReorderLine.findMany({
        where: { sheetId: sheet.id },
        select: { itemId: true, onHand: true, qtyToOrder: true },
      }),
    ])

    // Si el sheet es nuevo (o faltan líneas), creamos líneas con snapshot = 0
    // (Esto evita el “arrastre” automático entre fechas)
    const lineByItem = new Map(lines.map(l => [l.itemId, l]))
    const missingItemIds = items.filter(i => !lineByItem.has(i.id)).map(i => i.id)

    if (missingItemIds.length > 0) {
      await prisma.inventoryReorderLine.createMany({
        data: missingItemIds.map(itemId => ({
          sheetId: sheet.id,
          itemId,
          onHand: 0,
          qtyToOrder: 0,
        })),
        skipDuplicates: true,
      })

      const newLines = await prisma.inventoryReorderLine.findMany({
        where: { sheetId: sheet.id },
        select: { itemId: true, onHand: true, qtyToOrder: true },
      })
      lineByItem.clear()
      for (const l of newLines) lineByItem.set(l.itemId, l)
    }

    const catById = new Map(categories.map(c => [c.id, c.name]))

    const groups = new Map<string, Row[]>()
    for (const it of items) {
      const catName = it.categoryId ? (catById.get(it.categoryId) || 'UNCATEGORIZED') : 'UNCATEGORIZED'
      const line = lineByItem.get(it.id)

      const row: Row = {
        itemId: it.id,
        sku: it.sku,
        item: it.name,
        unit: it.unit,
        minStock: it.minStock ?? 0,
        createdAt: it.createdAt.toISOString(),
        category: catName,
        onHand: line?.onHand ?? 0,
        qtyToOrder: line?.qtyToOrder ?? 0,
      }

      if (!groups.has(catName)) groups.set(catName, [])
      groups.get(catName)!.push(row)
    }

    // sort items inside each category by createdAt, fallback sku
    const groupEntries = Array.from(groups.entries()) as Array<[string, Row[]]>
    for (const [k, arr] of groupEntries) {
      arr.sort((a, b) => {
        const da = +new Date(a.createdAt)
        const db = +new Date(b.createdAt)
        if (da !== db) return da - db
        return String(a.sku).localeCompare(String(b.sku))
      })
      groups.set(k, arr)
    }

    // sort categories to match Excel order, then alphabetical, with UNCATEGORIZED last
    const categoryNames = Array.from(groups.keys()).sort((a, b) => {
      const A = a.toUpperCase()
      const B = b.toUpperCase()
      if (A === 'UNCATEGORIZED') return 1
      if (B === 'UNCATEGORIZED') return -1
      const ra = categoryRank(A)
      const rb = categoryRank(B)
      if (ra !== rb) return ra - rb
      return A.localeCompare(B)
    })

    const categoriesOut = categoryNames.map(name => ({
      name,
      items: groups.get(name) || [],
    }))

    return json({
      location,
      date: date.toISOString().slice(0, 10),
      sheetId: sheet.id,
      categories: categoriesOut,
    })
  } catch (e) {
    console.error('GET /api/admin/inventory/daily error:', e)
    return json({ message: 'Internal server error' }, 500)
  }
}

/**
 * PATCH /api/admin/inventory/daily
 * Body: { locationId, date(YYYY-MM-DD), itemId, onHand?, qtyToOrder? }
 * ✅ Guarda snapshots en InventoryReorderLine (por día).
 */
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  try {
    const body = await req.json().catch(() => null)

    const locationId = (body?.locationId || '').toString().trim()
    const dateStr = (body?.date || '').toString().trim()
    const itemId = (body?.itemId || '').toString().trim()

    if (!locationId || !dateStr || !itemId) {
      return json({ message: 'locationId, date, itemId are required' }, 400)
    }

    const date = normalizeDateISO(dateStr)
    if (!date) return json({ message: 'invalid date' }, 400)

    const onHandRaw = body?.onHand
    const qtyToOrderRaw = body?.qtyToOrder

    const wantsOnHand = onHandRaw !== undefined
    const wantsQtyToOrder = qtyToOrderRaw !== undefined
    if (!wantsOnHand && !wantsQtyToOrder) {
      return json({ message: 'Provide onHand and/or qtyToOrder' }, 400)
    }

    const parsedOnHand = wantsOnHand ? Number(onHandRaw) : null
    const parsedToOrder = wantsQtyToOrder ? Number(qtyToOrderRaw) : null

    if (wantsOnHand && (!Number.isFinite(parsedOnHand!) || parsedOnHand! < 0)) {
      return json({ message: 'onHand must be a number >= 0' }, 400)
    }
    if (wantsQtyToOrder && (!Number.isFinite(parsedToOrder!) || parsedToOrder! < 0)) {
      return json({ message: 'qtyToOrder must be a number >= 0' }, 400)
    }

    const result = await prisma.$transaction(async (tx) => {
      const sheet = await tx.inventoryReorderSheet.upsert({
        where: { locationId_date: { locationId, date } },
        create: { locationId, date },
        update: {},
        select: { id: true },
      })

      const updateData: { onHand?: number; qtyToOrder?: number } = {}
      if (wantsOnHand) updateData.onHand = Math.floor(parsedOnHand!)
      if (wantsQtyToOrder) updateData.qtyToOrder = Math.floor(parsedToOrder!)

      const saved = await tx.inventoryReorderLine.upsert({
        where: { sheetId_itemId: { sheetId: sheet.id, itemId } },
        create: {
          sheetId: sheet.id,
          itemId,
          onHand: updateData.onHand ?? 0,
          qtyToOrder: updateData.qtyToOrder ?? 0,
        },
        update: updateData,
        select: { onHand: true, qtyToOrder: true },
      })

      return {
        locationId,
        date: date.toISOString().slice(0, 10),
        itemId,
        onHand: saved.onHand,
        qtyToOrder: saved.qtyToOrder,
      }
    })

    return json(result, 200)
  } catch (e) {
    console.error('PATCH /api/admin/inventory/daily error:', e)
    return json({ message: 'Internal server error' }, 500)
  }
}