// app/api/admin/inventory/items/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const active = searchParams.get('active')
  const take = Math.min(Math.max(Number(searchParams.get('take') || 200), 1), 500)

  const where: any = {}
  if (active === 'true') where.active = true
  if (active === 'false') where.active = false

  if (q) {
    where.OR = [
      { sku: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    take,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
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

  if (!sku || !name) return json({ message: 'sku and name are required' }, 400)
  if (!Number.isFinite(minStock) || minStock < 0) return json({ message: 'minStock must be >= 0' }, 400)

  const created = await prisma.inventoryItem.create({
    data: { sku, name, unit, minStock, active: true },
  })

  return json(created, 201)
}