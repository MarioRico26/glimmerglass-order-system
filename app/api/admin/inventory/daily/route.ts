// app/api/admin/inventory/daily/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function parseDateOnly(s: string) {
  // Guarda como UTC midnight
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

type DailyRow = {
  itemId: string
  sku: string
  name: string
  unit: string
  minStock: number
  onHand: number
  qtyToOrder: number
  category: { id: string; name: string; sortOrder: number }
  itemSortOrder: number
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const { searchParams } = new URL(req.url)
  const locationId = (searchParams.get('locationId') || '').trim()
  const dateStr = (searchParams.get('date') || '').trim()

  if (!locationId) return json({ message: 'locationId is required (UUID)' }, 400)
  if (!dateStr) return json({ message: 'date is required (YYYY-MM-DD)' }, 400)

  const date = parseDateOnly(dateStr)
  if (!date) return json({ message: 'invalid date format (YYYY-MM-DD)' }, 400)

  const location = await prisma.inventoryLocation.findUnique({
    where: { id: locationId },
    select: { id: true, name: true, active: true, type: true },
  })
  if (!location || !location.active) return json({ message: 'location not found/active' }, 404)

  // sheet + lines (qtyToOrder)
  const sheet = await prisma.inventoryReorderSheet.upsert({
    where: { locationId_date: { locationId, date } },
    create: { locationId, date },
    update: {},
    select: {
      id: true,
      date: true,
      lines: { select: { itemId: true, qtyToOrder: true } },
    },
  })
  const lineMap = new Map<string, number>()
  for (const l of sheet.lines) lineMap.set(l.itemId, l.qtyToOrder)

  // stock (onHand)
  const stocks = await prisma.inventoryStock.findMany({
    where: { locationId },
    select: { itemId: true, onHand: true },
  })
  const stockMap = new Map<string, number>()
  for (const s of stocks) stockMap.set(s.itemId, s.onHand)

  // items ordered like Excel: category.sortOrder -> item.sortOrder -> sku
  const items = await prisma.inventoryItem.findMany({
    where: { active: true },
    select: {
      id: true,
      sku: true,
      name: true,
      unit: true,
      minStock: true,
      sortOrder: true,
      category: { select: { id: true, name: true, sortOrder: true } },
    },
    orderBy: [
      { category: { sortOrder: 'asc' } },
      { sortOrder: 'asc' },
      { sku: 'asc' },
    ],
  })

  const rows: DailyRow[] = items
    .filter((it) => it.category) // si no tiene category, no existe en Excel. afuera.
    .map((it) => ({
      itemId: it.id,
      sku: it.sku,
      name: it.name,
      unit: it.unit,
      minStock: it.minStock,
      onHand: stockMap.get(it.id) ?? 0,
      qtyToOrder: lineMap.get(it.id) ?? 0,
      category: {
        id: it.category!.id,
        name: it.category!.name,
        sortOrder: it.category!.sortOrder ?? 9999,
      },
      itemSortOrder: it.sortOrder ?? 9999,
    }))

  // group para pintar headers tipo Excel
  const grouped = new Map<string, { category: DailyRow['category']; rows: DailyRow[] }>()
  for (const r of rows) {
    const key = r.category.id
    if (!grouped.has(key)) grouped.set(key, { category: r.category, rows: [] })
    grouped.get(key)!.rows.push(r)
  }

  const groups = Array.from(grouped.values()).sort(
    (a: { category: DailyRow['category'] }, b: { category: DailyRow['category'] }) =>
      (a.category.sortOrder ?? 9999) - (b.category.sortOrder ?? 9999)
  )

  return json({
    location,
    date: toISODate(date),
    sheetId: sheet.id,
    groups,
  })
}

type PatchBody = {
  locationId: string
  date: string
  updates: Array<{
    itemId: string
    onHand?: number
    qtyToOrder?: number
  }>
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const body = (await req.json().catch(() => null)) as PatchBody | null
  const locationId = (body?.locationId || '').trim()
  const dateStr = (body?.date || '').trim()
  const updates = Array.isArray(body?.updates) ? body!.updates : []

  if (!locationId) return json({ message: 'locationId is required' }, 400)
  if (!dateStr) return json({ message: 'date is required' }, 400)
  const date = parseDateOnly(dateStr)
  if (!date) return json({ message: 'invalid date format (YYYY-MM-DD)' }, 400)
  if (!updates.length) return json({ message: 'updates[] is required' }, 400)

  // valida ints
  for (const u of updates) {
    if (!u.itemId) return json({ message: 'updates[].itemId is required' }, 400)
    if (u.onHand !== undefined) {
      const v = Number(u.onHand)
      if (!Number.isFinite(v) || v < 0) return json({ message: 'onHand must be >= 0' }, 400)
    }
    if (u.qtyToOrder !== undefined) {
      const v = Number(u.qtyToOrder)
      if (!Number.isFinite(v) || v < 0) return json({ message: 'qtyToOrder must be >= 0' }, 400)
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const sheet = await tx.inventoryReorderSheet.upsert({
      where: { locationId_date: { locationId, date } },
      create: { locationId, date },
      update: {},
      select: { id: true },
    })

    for (const u of updates) {
      if (u.onHand !== undefined) {
        await tx.inventoryStock.upsert({
          where: { itemId_locationId: { itemId: u.itemId, locationId } },
          create: { itemId: u.itemId, locationId, onHand: Math.floor(Number(u.onHand)) },
          update: { onHand: Math.floor(Number(u.onHand)) },
        })
      }

      if (u.qtyToOrder !== undefined) {
        await tx.inventoryReorderLine.upsert({
          where: { sheetId_itemId: { sheetId: sheet.id, itemId: u.itemId } },
          create: { sheetId: sheet.id, itemId: u.itemId, qtyToOrder: Math.floor(Number(u.qtyToOrder)) },
          update: { qtyToOrder: Math.floor(Number(u.qtyToOrder)) },
        })
      }
    }

    return { ok: true, sheetId: sheet.id }
  })

  return json(result)
}