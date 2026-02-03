// app/api/admin/inventory/daily/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Normaliza YYYY-MM-DD a Date UTC (00:00:00Z)
 * Esto evita bugs por timezone donde “2026-01-20” termina siendo 19 o 21.
 */
function dayStartUTC(dateStr: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0))
}

function todayUTCString() {
  return new Date().toISOString().slice(0, 10)
}

type DailyRow = {
  itemId: string
  sku: string
  item: string
  unit: string
  minStock: number
  category: string
  onHand: number
  qtyToOrder: number
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const { searchParams } = new URL(req.url)
  const locationId = (searchParams.get('locationId') || '').trim()
  const dateStr = (searchParams.get('date') || '').trim()

  if (!locationId) return json({ message: 'locationId is required' }, 400)
  if (!dateStr) return json({ message: 'date is required (YYYY-MM-DD)' }, 400)

  const date = dayStartUTC(dateStr)
  if (!date) return json({ message: 'invalid date format (YYYY-MM-DD)' }, 400)

  try {
    const location = await prisma.inventoryLocation.findUnique({
      where: { id: locationId },
      select: { id: true, name: true, type: true, active: true },
    })
    if (!location) return json({ message: 'Location not found' }, 404)
    if (!location.active) return json({ message: 'Location is inactive' }, 400)

    const result = await prisma.$transaction(async (tx) => {
      // 1) Sheet (1 por location+date)
      const sheet = await tx.inventoryReorderSheet.upsert({
        where: { locationId_date: { locationId, date } },
        create: { locationId, date },
        update: {},
        select: { id: true, date: true, locationId: true },
      })

      // 2) Items activos (con categoría)
      const items = await tx.inventoryItem.findMany({
        where: { active: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          minStock: true,
          sortOrder: true,
          categoryId: true,
          category: { select: { id: true, name: true, active: true } },
        },
        orderBy: [
          { category: { name: 'asc' } },
          { sortOrder: 'asc' },
          { sku: 'asc' },
        ],
      })

      // 3) Stock actual para “prefill”
      const stocks = await tx.inventoryStock.findMany({
        where: { locationId, itemId: { in: items.map(i => i.id) } },
        select: { itemId: true, onHand: true },
      })
      const stockMap = new Map(stocks.map(s => [s.itemId, s.onHand]))

      // 4) Líneas existentes para ese día
      const existing = await tx.inventoryReorderLine.findMany({
        where: { sheetId: sheet.id },
        select: { itemId: true },
      })
      const existingSet = new Set(existing.map(e => e.itemId))

      // 5) Crear líneas faltantes (una por item) con snapshot inicial = stock actual
      const missing = items
        .filter(i => !existingSet.has(i.id))
        .map(i => ({
          sheetId: sheet.id,
          itemId: i.id,
          onHand: stockMap.get(i.id) ?? 0,
          qtyToOrder: 0,
        }))

      if (missing.length) {
        await tx.inventoryReorderLine.createMany({ data: missing })
      }

      // 6) Traer líneas ya completas
      const lines = await tx.inventoryReorderLine.findMany({
        where: { sheetId: sheet.id },
        select: { itemId: true, onHand: true, qtyToOrder: true },
      })
      const lineMap = new Map(lines.map(l => [l.itemId, l]))

      // 7) Construir rows + categories
      const rows: DailyRow[] = items.map(i => {
        const catName = i.category?.name || 'Uncategorized'
        const line = lineMap.get(i.id)
        return {
          itemId: i.id,
          sku: i.sku,
          item: i.name,
          unit: i.unit,
          minStock: i.minStock,
          category: catName,
          onHand: line?.onHand ?? 0,
          qtyToOrder: line?.qtyToOrder ?? 0,
        }
      })

      const grouped = new Map<string, DailyRow[]>()
      for (const r of rows) {
        if (!grouped.has(r.category)) grouped.set(r.category, [])
        grouped.get(r.category)!.push(r)
      }

      const categories = Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, items]) => ({ name, items }))

      return { sheetId: sheet.id, categories }
    })

    return json({
      location,
      date: dateStr,
      sheetId: result.sheetId,
      categories: result.categories,
    })
  } catch (e) {
    console.error('GET /api/admin/inventory/daily error:', e)
    return json({ message: 'Internal server error' }, 500)
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const body = await req.json().catch(() => null)

  const locationId = String(body?.locationId || '').trim()
  const dateStr = String(body?.date || '').trim()
  const itemId = String(body?.itemId || '').trim()

  if (!locationId || !dateStr || !itemId) {
    return json({ message: 'locationId, date, itemId are required' }, 400)
  }

  const date = dayStartUTC(dateStr)
  if (!date) return json({ message: 'invalid date format (YYYY-MM-DD)' }, 400)

  const hasOnHand = body?.onHand !== undefined
  const hasQtyToOrder = body?.qtyToOrder !== undefined

  if (!hasOnHand && !hasQtyToOrder) {
    return json({ message: 'Provide onHand or qtyToOrder' }, 400)
  }

  const data: any = {}
  if (hasOnHand) {
    const v = Number(body.onHand)
    if (!Number.isFinite(v) || v < 0) return json({ message: 'onHand must be >= 0' }, 400)
    data.onHand = Math.floor(v)
  }
  if (hasQtyToOrder) {
    const v = Number(body.qtyToOrder)
    if (!Number.isFinite(v) || v < 0) return json({ message: 'qtyToOrder must be >= 0' }, 400)
    data.qtyToOrder = Math.floor(v)
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // sheet upsert
      const sheet = await tx.inventoryReorderSheet.upsert({
        where: { locationId_date: { locationId, date } },
        create: { locationId, date },
        update: {},
        select: { id: true },
      })

      // line upsert
      const line = await tx.inventoryReorderLine.upsert({
        where: { sheetId_itemId: { sheetId: sheet.id, itemId } },
        create: {
          sheetId: sheet.id,
          itemId,
          onHand: data.onHand ?? 0,
          qtyToOrder: data.qtyToOrder ?? 0,
        },
        update: data,
        select: { itemId: true, onHand: true, qtyToOrder: true },
      })

      // ✅ Si están editando “hoy”, podemos reflejarlo como stock actual
      // Si editan días pasados, NO tocamos el stock actual.
      if (hasOnHand && dateStr === todayUTCString()) {
        await tx.inventoryStock.upsert({
          where: { itemId_locationId: { itemId, locationId } },
          create: { itemId, locationId, onHand: line.onHand },
          update: { onHand: line.onHand },
        })
      }

      return line
    })

    return json(result, 200)
  } catch (e) {
    console.error('PATCH /api/admin/inventory/daily error:', e)
    return json({ message: 'Internal server error' }, 500)
  }
}