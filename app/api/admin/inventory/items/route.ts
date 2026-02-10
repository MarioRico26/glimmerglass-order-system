// app/api/admin/inventory/items/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const active = searchParams.get('active')
  const categoryId = (searchParams.get('categoryId') || '').trim()
  const take = Math.min(Math.max(Number(searchParams.get('take') || 200), 1), 500)

  const where: {
    active?: boolean
    categoryId?: string
    OR?: Array<
      | { sku: { contains: string; mode: 'insensitive' } }
      | { name: { contains: string; mode: 'insensitive' } }
    >
  } = {}
  if (active === 'true') where.active = true
  if (active === 'false') where.active = false
  if (categoryId) where.categoryId = categoryId

  if (q) {
    where.OR = [
      { sku: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    include: { category: { select: { id: true, name: true } } },
    take,
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })

  return json({ items })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const body = await req.json().catch(() => null)
  const sku = (body?.sku || '').toString().trim()
  const name = (body?.name || '').toString().trim()
  const unit = (body?.unit || 'ea').toString().trim()
  const minStock = body?.minStock === '' || body?.minStock === undefined ? 0 : Number(body?.minStock)
  const sortOrder = body?.sortOrder === '' || body?.sortOrder === undefined ? 9999 : Number(body?.sortOrder)
  const categoryIdRaw = body?.categoryId
  const categoryId =
    categoryIdRaw === null
      ? null
      : typeof categoryIdRaw === 'string' && categoryIdRaw.trim()
        ? categoryIdRaw.trim()
        : undefined
  const active = body?.active === undefined ? true : Boolean(body.active)

  if (!sku || !name) return json({ message: 'sku and name are required' }, 400)
  if (!Number.isFinite(minStock) || minStock < 0) return json({ message: 'minStock must be >= 0' }, 400)
  if (!Number.isFinite(sortOrder)) return json({ message: 'sortOrder must be a number' }, 400)

  const created = await prisma.inventoryItem.create({
    data: {
      sku,
      name,
      unit,
      minStock,
      sortOrder,
      active,
      ...(categoryId !== undefined ? { categoryId } : {}),
    },
    include: { category: { select: { id: true, name: true } } },
  })

  return json(created, 201)
}
