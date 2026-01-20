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
  // accepts yyyy-mm-dd or ISO
  const d = new Date(dateStr)
  if (Number.isNaN(+d)) return null
  // normalize to UTC midnight
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
 * Returns rows grouped by category with onHand + qtyToOrder
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

    // sheet get-or-create (needed for qtyToOrder)
    const sheet = await prisma.inventoryReorderSheet.upsert({
      where: { locationId_date: { locationId, date } },
      create: { locationId, date },
      update: {},
      select: { id: true, locationId: true, date: true },
    })

    const [items, stocks, lines, categories] = await Promise.all([
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
      prisma.inventoryStock.findMany({
        where: { locationId },
        select: { itemId: true, onHand: true },
      }),
      prisma.inventoryReorderLine.findMany({
        where: { sheetId: sheet.id },
        select: { itemId: true, qtyToOrder: true },
      }),
      prisma.inventoryCategory.findMany({
        where: { active: true },
        select: { id: true, name: true },
      }),
    ])

    const catById = new Map(categories.map(c => [c.id, c.name]))
    const onHandByItem = new Map(stocks.map(s => [s.itemId, s.onHand]))
    const toOrderByItem = new Map(lines.map(l => [l.itemId, l.qtyToOrder]))

    // Build grouped rows
    const groups = new Map<string, Array<any>>() // categoryName -> items
    for (const it of items) {
      const catName = it.categoryId ? (catById.get(it.categoryId) || 'UNCATEGORIZED') : 'UNCATEGORIZED'
      const row = {
        itemId: it.id,
        sku: it.sku,
        item: it.name,
        unit: it.unit,
        minStock: it.minStock ?? 0,
        createdAt: it.createdAt.toISOString(),
        category: catName,
        onHand: onHandByItem.get(it.id) ?? 0,
        qtyToOrder: toOrderByItem.get(it.id) ?? 0,
      }
      if (!groups.has(catName)) groups.set(catName, [])
      groups.get(catName)!.push(row)
    }

    // sort items inside each category by createdAt (seed order), fallback sku
const groupEntries = Array.from(groups.entries()) as Array<[string, Row[]]>
for (let i = 0; i < groupEntries.length; i++) {
  const [k, arr] = groupEntries[i]
  arr.sort((a: Row, b: Row) => {
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
 * - onHand sets absolute inventory stock
 * - qtyToOrder sets absolute reorder line
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
      let onHand: number | undefined
      let qtyToOrder: number | undefined

      if (wantsOnHand) {
        const stock = await tx.inventoryStock.upsert({
          where: { itemId_locationId: { itemId, locationId } },
          create: { itemId, locationId, onHand: Math.floor(parsedOnHand!) },
          update: { onHand: Math.floor(parsedOnHand!) },
          select: { onHand: true },
        })
        onHand = stock.onHand
      }

      if (wantsQtyToOrder) {
        const sheet = await tx.inventoryReorderSheet.upsert({
          where: { locationId_date: { locationId, date } },
          create: { locationId, date },
          update: {},
          select: { id: true },
        })

        const val = Math.floor(parsedToOrder!)
        if (val === 0) {
          await tx.inventoryReorderLine.deleteMany({ where: { sheetId: sheet.id, itemId } })
          qtyToOrder = 0
        } else {
          const saved = await tx.inventoryReorderLine.upsert({
            where: { sheetId_itemId: { sheetId: sheet.id, itemId } },
            create: { sheetId: sheet.id, itemId, qtyToOrder: val },
            update: { qtyToOrder: val },
            select: { qtyToOrder: true },
          })
          qtyToOrder = saved.qtyToOrder
        }
      }

      return { locationId, date: date.toISOString().slice(0, 10), itemId, onHand, qtyToOrder }
    })

    return json(result, 200)
  } catch (e) {
    console.error('PATCH /api/admin/inventory/daily error:', e)
    return json({ message: 'Internal server error' }, 500)
  }
} 