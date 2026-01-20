// app/api/admin/inventory/locations/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { InventoryLocationType } from '@prisma/client'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const type = (searchParams.get('type') || '').trim()
  const active = searchParams.get('active')

  const where: any = {}
  if (active === 'true') where.active = true
  if (active === 'false') where.active = false
  if (type && Object.values(InventoryLocationType).includes(type as any)) {
    where.type = type
  }
  if (q) {
    where.name = { contains: q, mode: 'insensitive' }
  }

  const locations = await prisma.inventoryLocation.findMany({
    where,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: { factoryLocation: { select: { id: true, name: true } } },
  })

  return json({ locations })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return json({ message: gate.message }, gate.status)

  const body = await req.json().catch(() => null)
  const name = (body?.name || '').toString().trim()
  const type = (body?.type || 'WAREHOUSE').toString().trim()
  const factoryLocationId = body?.factoryLocationId ? String(body.factoryLocationId) : null

  if (!name) return json({ message: 'name is required' }, 400)
  if (!Object.values(InventoryLocationType).includes(type as any)) {
    return json({ message: 'invalid type' }, 400)
  }

  // regla: si type=FACTORY, puede tener factoryLocationId; si no, lo limpiamos
  const data: any = {
    name,
    type,
    active: true,
    factoryLocationId: type === 'FACTORY' ? factoryLocationId : null,
  }

  const created = await prisma.inventoryLocation.create({
    data,
    include: { factoryLocation: { select: { id: true, name: true } } },
  })

  return json(created, 201)
}