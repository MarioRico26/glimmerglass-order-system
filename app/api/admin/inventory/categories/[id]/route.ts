import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

function json(message: string, status = 400, extra?: any) {
  return NextResponse.json({ message, ...(extra ?? {}) }, { status, headers: { 'Cache-Control': 'no-store' } })
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
    const item = await prisma.inventoryCategory.findUnique({ where: { id } })
    if (!item) return json('Not found', 404)

    return NextResponse.json(item, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/admin/inventory/categories/[id] error:', e)
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

    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const sortOrder =
      body?.sortOrder !== undefined
        ? Number(body.sortOrder)
        : undefined

    const updated = await prisma.inventoryCategory.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(sortOrder !== undefined && Number.isFinite(sortOrder) ? { sortOrder } : {}),
      },
    })

    return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('PATCH /api/admin/inventory/categories/[id] error:', e)
    if (e?.code === 'P2025') return json('Not found', 404)
    if (e?.code === 'P2002') return json('Category name already exists', 400)
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

    // OJO: si hay items asociados, esto va a fallar si tu FK es restrict.
    // Recomendación: NO borrar, sino “archivar”. Si tu modelo tiene `active`, usa eso.
    // Si NO tienes active, entonces solo impedimos borrar si hay items.
    const count = await prisma.inventoryItem.count({ where: { categoryId: id } })
    if (count > 0) return json('Cannot delete category with items. Move items first.', 400)

    await prisma.inventoryCategory.delete({ where: { id } })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('DELETE /api/admin/inventory/categories/[id] error:', e)
    if (e?.code === 'P2025') return json('Not found', 404)
    return json('Internal server error', 500)
  }
}