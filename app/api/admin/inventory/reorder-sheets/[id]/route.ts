// glimmerglass-order-system/app/api/admin/inventory/reorder-sheets/[id]/route.ts
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
async function getId(ctx: Ctx) {
  const p: any = ctx.params
  return ('then' in p ? (await p).id : p.id) as string
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const id = await getId(ctx)

    const sheet = await prisma.inventoryReorderSheet.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true, type: true } },
        lines: {
          // ❌ no createdAt en InventoryReorderLine
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
    return NextResponse.json(sheet, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/admin/inventory/reorder-sheets/[id] error:', e)
    return json('Internal server error', 500)
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const id = await getId(ctx)
    const body = await req.json().catch(() => null)

    const notes = body?.notes !== undefined ? String(body.notes) : undefined

    const updated = await prisma.inventoryReorderSheet.update({
      where: { id },
      data: {
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        location: { select: { id: true, name: true, type: true } },
      },
    })

    return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('PATCH /api/admin/inventory/reorder-sheets/[id] error:', e)
    if (e?.code === 'P2025') return json('Not found', 404)
    return json('Internal server error', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdmin(user.role)) return json('Forbidden', 403)

    const id = await getId(ctx)

    // ✅ tu FK ya tiene onDelete: Cascade, pero igual borrar explícito no hace daño
    await prisma.inventoryReorderLine.deleteMany({ where: { sheetId: id } })
    await prisma.inventoryReorderSheet.delete({ where: { id } })

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('DELETE /api/admin/inventory/reorder-sheets/[id] error:', e)
    if (e?.code === 'P2025') return json('Not found', 404)
    return json('Internal server error', 500)
  }
}