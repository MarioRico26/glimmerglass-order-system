import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { Prisma } from '@prisma/client'

export async function GET() {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const items = await prisma.color.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ items })
  } catch (e:any) {
    console.error('GET /colors error:', e)
    return NextResponse.json({ message: e.message || 'Unauthorized' }, { status: e.status || 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const { name, swatchUrl } = await req.json()
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ message: 'name requerido' }, { status: 400 })
    }

    const data: any = { name: name.trim() }
    if (swatchUrl && typeof swatchUrl === 'string' && swatchUrl.trim() !== '') {
      data.swatchUrl = swatchUrl.trim()
    }

    const item = await prisma.color.create({ data })
    return NextResponse.json({ item }, { status: 201 })
  } catch (e: any) {
    console.error('POST /colors error:', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ message: 'Color ya existe' }, { status: 409 })
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const { id, name, swatchUrl } = await req.json()
    if (!id) return NextResponse.json({ message: 'id requerido' }, { status: 400 })
    const data: any = {}
    if (typeof name === 'string') data.name = name.trim()
    if (typeof swatchUrl === 'string') data.swatchUrl = swatchUrl.trim()
    const item = await prisma.color.update({ where: { id }, data })
    return NextResponse.json({ item })
  } catch (e:any) {
    console.error('PATCH /colors error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const { id } = await req.json()
    if (!id) return NextResponse.json({ message: 'id requerido' }, { status: 400 })
    await prisma.color.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    console.error('DELETE /colors error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}