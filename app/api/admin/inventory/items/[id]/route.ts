// app/api/admin/inventory/items/[id]/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }
async function getId(ctx: Ctx) {
  const p = ctx.params as { id: string } | Promise<{ id: string }>
  return ('then' in p ? (await p).id : p.id) as string
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const id = await getId(ctx)
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  })

  if (!item) return json({ message: 'Not found' }, 404)
  return json(item)
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const id = await getId(ctx)
  const body = await req.json().catch(() => null)

  const data: {
    sku?: string
    name?: string
    unit?: string
    active?: boolean
    minStock?: number
    sortOrder?: number
    categoryId?: string | null
  } = {}
  if (body?.sku !== undefined) data.sku = String(body.sku).trim()
  if (body?.name !== undefined) data.name = String(body.name).trim()
  if (body?.unit !== undefined) data.unit = String(body.unit).trim()
  if (body?.active !== undefined) data.active = !!body.active
  if (body?.minStock !== undefined) {
    const ms = Number(body.minStock)
    if (!Number.isFinite(ms) || ms < 0) return json({ message: 'minStock must be >= 0' }, 400)
    data.minStock = ms
  }
  if (body?.sortOrder !== undefined) {
    const so = Number(body.sortOrder)
    if (!Number.isFinite(so)) return json({ message: 'sortOrder must be a number' }, 400)
    data.sortOrder = so
  }
  if (body?.categoryId !== undefined) {
    if (body.categoryId === null) data.categoryId = null
    else if (typeof body.categoryId === 'string' && body.categoryId.trim()) {
      data.categoryId = body.categoryId.trim()
    } else {
      return json({ message: 'categoryId must be a non-empty string or null' }, 400)
    }
  }

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data,
    include: { category: { select: { id: true, name: true } } },
  })

  return json(updated)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const id = await getId(ctx)

  // soft delete para no romper txns históricos
  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: { active: false },
  })

  return json(updated)
}
