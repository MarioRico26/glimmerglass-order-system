import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdminAccess } from '@/lib/adminAccess'

function json(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }

async function getId(ctx: Ctx) {
  const params = ctx.params
  if (typeof (params as Promise<{ id: string }>).then === 'function') {
    return (await (params as Promise<{ id: string }>)).id
  }
  return (params as { id: string }).id
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAdminAccess(AdminModule.INVENTORY)

    const id = await getId(ctx)
    const sheet = await prisma.inventoryReorderSheet.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true, type: true } },
        lines: {
          orderBy: [{ item: { name: 'asc' } }],
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
        },
      },
    })

    if (!sheet) return json('Not found', 404)

    const lines = sheet.lines.map((line) => {
      const item = line.item ? { ...line.item, minStock: Number(line.item.minStock) } : line.item
      return {
        ...line,
        onHand: Number(line.onHand),
        qtyToOrder: Number(line.qtyToOrder),
        item,
      }
    })

    return NextResponse.json(
      { ...sheet, lines },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('GET /api/admin/inventory/reorder-sheets/[id] error:', e)
    return json('Internal server error', 500)
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdminAccess(AdminModule.INVENTORY)

    const id = await getId(ctx)
    const body = await req.json().catch(() => null)
    const notes = body?.notes !== undefined ? String(body.notes) : undefined

    const updated = await prisma.inventoryReorderSheet.update({
      where: { id },
      data: notes !== undefined ? { notes } : {},
      include: { location: { select: { id: true, name: true, type: true } } },
    })

    return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    console.error('PATCH /api/admin/inventory/reorder-sheets/[id] error:', e)
    const err = e as { code?: string }
    if (err?.code === 'P2025') return json('Not found', 404)
    return json('Internal server error', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as { email?: string; role?: string } | undefined
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const id = await getId(ctx)
    await prisma.inventoryReorderLine.deleteMany({ where: { sheetId: id } })
    await prisma.inventoryReorderSheet.delete({ where: { id } })

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    console.error('DELETE /api/admin/inventory/reorder-sheets/[id] error:', e)
    const err = e as { code?: string }
    if (err?.code === 'P2025') return json('Not found', 404)
    return json('Internal server error', 500)
  }
}
