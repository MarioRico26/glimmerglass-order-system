import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizeDate(dateStr: string) {
  // dateStr: 'YYYY-MM-DD'
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date')
  return d
}

async function resolveLocation(locationIdOrName: string) {
  // acepta UUID o nombre (Fort Plain)
  const byId = await prisma.inventoryLocation.findUnique({
    where: { id: locationIdOrName },
    select: { id: true, name: true, type: true, active: true },
  })
  if (byId) return byId

  const byName = await prisma.inventoryLocation.findFirst({
    where: { name: locationIdOrName },
    select: { id: true, name: true, type: true, active: true },
  })
  if (byName) return byName

  return null
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const locationParam = searchParams.get('locationId') ?? ''
    const dateParam = searchParams.get('date') ?? ''

    if (!locationParam || !dateParam) {
      return NextResponse.json(
        { error: 'locationId and date are required' },
        { status: 400 }
      )
    }

    const location = await resolveLocation(locationParam)
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const date = normalizeDate(dateParam)

    // 1) Asegura sheet único por (locationId, date)
    const sheet = await prisma.inventoryReorderSheet.upsert({
      where: {
        locationId_date: { locationId: location.id, date },
      },
      create: { locationId: location.id, date },
      update: {},
      select: { id: true, locationId: true, date: true },
    })

    // 2) Trae items activos con categoría
    const items = await prisma.inventoryItem.findMany({
      where: { active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        minStock: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { sku: 'asc' },
      ],
    })

    // 3) Asegura líneas para ese sheet (sin “arrastrar” valores)
    //    Si no existen líneas, se crean en 0 / 0.
    const existing = await prisma.inventoryReorderLine.findMany({
      where: { sheetId: sheet.id },
      select: { itemId: true, onHand: true, qtyToOrder: true },
    })

    const existingMap = new Map(existing.map(l => [l.itemId, l]))

    const missing = items
      .filter(it => !existingMap.has(it.id))
      .map(it => ({
        sheetId: sheet.id,
        itemId: it.id,
        onHand: 0,
        qtyToOrder: 0,
      }))

    if (missing.length) {
      await prisma.inventoryReorderLine.createMany({ data: missing })
    }

    // recarga líneas (ya completas)
    const lines = await prisma.inventoryReorderLine.findMany({
      where: { sheetId: sheet.id },
      select: { itemId: true, onHand: true, qtyToOrder: true },
    })
    const lineMap = new Map(lines.map(l => [l.itemId, l]))

    // 4) Formato por categorías
    const grouped = new Map<string, any[]>()

    for (const it of items) {
      const catName = it.category?.name ?? 'Uncategorized'
      const line = lineMap.get(it.id)

      const row = {
        itemId: it.id,
        sku: it.sku,
        item: it.name,
        unit: it.unit,
        minStock: it.minStock,
        category: catName,
        onHand: line?.onHand ?? 0,
        qtyToOrder: line?.qtyToOrder ?? 0,
      }

      const arr = grouped.get(catName) ?? []
      arr.push(row)
      grouped.set(catName, arr)
    }

    const categories = Array.from(grouped.entries()).map(([name, items]) => ({
      name,
      items,
    }))

    return NextResponse.json({
      location,
      date: dateParam,
      sheetId: sheet.id,
      categories,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to load daily inventory' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const locationId = body?.locationId as string | undefined
    const date = body?.date as string | undefined
    const changes = body?.changes as
      | { itemId: string; onHand?: number; qtyToOrder?: number }[]
      | undefined

    if (!locationId || !date || !Array.isArray(changes) || !changes.length) {
      return NextResponse.json(
        { error: 'locationId, date, itemId are required' },
        { status: 400 }
      )
    }

    const location = await resolveLocation(locationId)
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const normalized = normalizeDate(date)

    const sheet = await prisma.inventoryReorderSheet.upsert({
      where: { locationId_date: { locationId: location.id, date: normalized } },
      create: { locationId: location.id, date: normalized },
      update: {},
      select: { id: true },
    })

    // actualiza en transacción
    await prisma.$transaction(
      changes.map(c =>
        prisma.inventoryReorderLine.upsert({
          where: { sheetId_itemId: { sheetId: sheet.id, itemId: c.itemId } },
          create: {
            sheetId: sheet.id,
            itemId: c.itemId,
            onHand: Number(c.onHand ?? 0),
            qtyToOrder: Number(c.qtyToOrder ?? 0),
          },
          update: {
            onHand: c.onHand !== undefined ? Number(c.onHand) : undefined,
            qtyToOrder: c.qtyToOrder !== undefined ? Number(c.qtyToOrder) : undefined,
          },
        })
      )
    )

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to save daily inventory' },
      { status: 500 }
    )
  }
}