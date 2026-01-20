import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

function json(message: string, status = 400, extra?: any) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

function isAdmin(role: any) {
  return role === 'ADMIN' || role === 'SUPERADMIN'
}

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }
async function getSheetId(ctx: Ctx) {
  const p: any = ctx.params
  return ('then' in p ? (await p).id : p.id) as string
}

/**
 * GET: lista líneas del sheet (para pintar la tabla de “QTY TO ORDER”)
 * Opcional query:
 * - q=texto (filtra por sku/name)
 * - categoryId=uuid
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const sheetId = await getSheetId(ctx)

    // Validar que el sheet existe (para errores decentes)
    const sheet = await prisma.inventoryReorderSheet.findUnique({
      where: { id: sheetId },
      select: { id: true, locationId: true, date: true },
    })
    if (!sheet) return json('Sheet not found', 404)

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const categoryId = (searchParams.get('categoryId') || '').trim()

    const where: any = { sheetId }

    if (q) {
      where.item = {
        OR: [
          { sku: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      }
    }

    if (categoryId) {
      where.item = {
        ...(where.item ?? {}),
        categoryId,
      }
    }

    const items = await prisma.inventoryReorderLine.findMany({
      where,
      orderBy: [
        // No tienes createdAt en line, así que ordenamos por nombre/sku (estable y útil)
        { item: { name: 'asc' } },
        { item: { sku: 'asc' } },
      ],
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            minStock: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(
      { sheet, items },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('GET /api/admin/inventory/reorder-sheets/[id]/lines error:', e)
    return json('Internal server error', 500)
  }
}

/**
 * PATCH: upsert qtyToOrder por (sheetId + itemId)
 * Body: { itemId: string, qtyToOrder: number }
 *
 * Regla:
 * - qtyToOrder === 0 => borra la línea (más limpio)
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const sheetId = await getSheetId(ctx)
    const body = await req.json().catch(() => null)

    const itemId = (body?.itemId ?? '').toString().trim()
    const qtyRaw = body?.qtyToOrder

    if (!itemId) return json('itemId is required', 400)

    const qtyToOrder = Number(qtyRaw)
    if (!Number.isFinite(qtyToOrder) || qtyToOrder < 0) {
      return json('qtyToOrder must be a number >= 0', 400)
    }

    // Validar sheet existe (evita upserts huérfanos)
    const sheet = await prisma.inventoryReorderSheet.findUnique({
      where: { id: sheetId },
      select: { id: true },
    })
    if (!sheet) return json('Sheet not found', 404)

    // qty=0 => borrar
    if (qtyToOrder === 0) {
      await prisma.inventoryReorderLine.deleteMany({ where: { sheetId, itemId } })
      return NextResponse.json(
        { ok: true, deleted: true },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // ✅ Upsert real usando el @@unique([sheetId, itemId])
    // Prisma genera el nombre compuesto: sheetId_itemId
    const saved = await prisma.inventoryReorderLine.upsert({
      where: { sheetId_itemId: { sheetId, itemId } },
      create: { sheetId, itemId, qtyToOrder },
      update: { qtyToOrder },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            minStock: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(saved, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('PATCH /api/admin/inventory/reorder-sheets/[id]/lines error:', e)
    return json('Internal server error', 500)
  }
}