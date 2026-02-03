// app/api/admin/inventory/daily/route.ts
import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

function asISODateOnly(input: string) {
  // Espera YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null
  return input
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get("locationId") || ""
    const date = searchParams.get("date") || ""

    const iso = asISODateOnly(date)
    if (!locationId || !iso) {
      return jsonError("locationId and date are required (YYYY-MM-DD)", 400)
    }

    const location = await prisma.inventoryLocation.findUnique({
      where: { id: locationId },
      select: { id: true, name: true, type: true, active: true },
    })

    if (!location) return jsonError("Location not found", 404)

    // Crea/obtiene sheet diario por location+date
    const sheet = await prisma.inventoryReorderSheet.upsert({
      where: {
        locationId_date: { locationId, date: new Date(iso) },
      },
      create: {
        locationId,
        date: new Date(iso),
      },
      update: {},
      select: { id: true, locationId: true, date: true },
    })

    // Trae items + category, ordenados para mostrar
    const items = await prisma.inventoryItem.findMany({
      where: { active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        minStock: true,
        sortOrder: true,
        category: { select: { name: true, sortOrder: true } },
      },
      orderBy: [
        { category: { sortOrder: "asc" } },
        { category: { name: "asc" } },
        { sortOrder: "asc" },
        { sku: "asc" },
      ],
    })

    const lines = await prisma.inventoryReorderLine.findMany({
      where: { sheetId: sheet.id },
      select: { itemId: true, onHand: true, qtyToOrder: true },
    })

    const lineMap = new Map(lines.map((l) => [l.itemId, l]))

    // Agrupar por categoría
    const grouped = new Map<string, any[]>()
    for (const it of items) {
      const catName = it.category?.name ?? "Uncategorized"
      const arr = grouped.get(catName) ?? []
      const line = lineMap.get(it.id)

      arr.push({
        itemId: it.id,
        sku: it.sku,
        item: it.name,
        unit: it.unit,
        minStock: it.minStock ?? 0,
        category: catName,
        onHand: line?.onHand ?? 0,
        qtyToOrder: line?.qtyToOrder ?? 0,
      })

      grouped.set(catName, arr)
    }

    const categories = Array.from(grouped.entries()).map(([name, items]) => ({
      name,
      items,
    }))

    return NextResponse.json({
      location,
      date: iso,
      sheetId: sheet.id,
      categories,
    })
  } catch (e: any) {
    console.error("GET /inventory/daily error:", e)
    return jsonError("Internal Server Error", 500)
  }
}

type BulkChange = {
  itemId: string
  onHand?: number | null
  qtyToOrder?: number | null
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return jsonError("Invalid JSON body", 400)

    const locationId: string | undefined = body.locationId
    const date: string | undefined = body.date

    const iso = typeof date === "string" ? asISODateOnly(date) : null
    if (!locationId || !iso) {
      return jsonError("locationId and date are required (YYYY-MM-DD)", 400)
    }

    // Asegura sheet
    const sheet = await prisma.inventoryReorderSheet.upsert({
      where: {
        locationId_date: { locationId, date: new Date(iso) },
      },
      create: {
        locationId,
        date: new Date(iso),
      },
      update: {},
      select: { id: true },
    })

    // ✅ Caso A: BULK
    if (Array.isArray(body.changes)) {
      const changes = body.changes as BulkChange[]

      if (changes.length === 0) {
        return NextResponse.json({ ok: true, updated: 0 })
      }

      // valida
      for (const c of changes) {
        if (!c?.itemId) return jsonError("Each change requires itemId", 400)
      }

      await prisma.$transaction(
        changes.map((c) =>
          prisma.inventoryReorderLine.upsert({
            where: {
              sheetId_itemId: { sheetId: sheet.id, itemId: c.itemId },
            },
            create: {
              sheetId: sheet.id,
              itemId: c.itemId,
              onHand: Math.max(0, Number(c.onHand ?? 0)),
              qtyToOrder: Math.max(0, Number(c.qtyToOrder ?? 0)),
            },
            update: {
              onHand: Math.max(0, Number(c.onHand ?? 0)),
              qtyToOrder: Math.max(0, Number(c.qtyToOrder ?? 0)),
            },
          })
        )
      )

      return NextResponse.json({ ok: true, updated: changes.length })
    }

    // ✅ Caso B: SINGLE
    const itemId: string | undefined = body.itemId
    if (!itemId) {
      return jsonError("locationId, date, itemId are required", 400)
    }

    const onHand = Math.max(0, Number(body.onHand ?? 0))
    const qtyToOrder = Math.max(0, Number(body.qtyToOrder ?? 0))

    await prisma.inventoryReorderLine.upsert({
      where: { sheetId_itemId: { sheetId: sheet.id, itemId } },
      create: { sheetId: sheet.id, itemId, onHand, qtyToOrder },
      update: { onHand, qtyToOrder },
    })

    return NextResponse.json({ ok: true, updated: 1 })
  } catch (e: any) {
    console.error("PATCH /inventory/daily error:", e)
    return jsonError("Internal Server Error", 500)
  }
}