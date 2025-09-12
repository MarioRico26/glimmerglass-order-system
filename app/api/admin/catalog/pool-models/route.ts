import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

export async function GET() {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const items = await prisma.poolModel.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ items })
  } catch (e:any) {
    return NextResponse.json({ message: e.message || 'Unauthorized' }, { status: e.status || 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const { name, lengthFt, widthFt, depthFt } = await req.json()
    if (!name) return NextResponse.json({ message: 'name requerido' }, { status: 400 })
    const item = await prisma.poolModel.create({ data: { name, lengthFt, widthFt, depthFt } })
    return NextResponse.json({ item }, { status: 201 })
  } catch (e:any) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ message: 'id requerido' }, { status: 400 })
    const item = await prisma.poolModel.update({ where: { id }, data })
    return NextResponse.json({ item })
  } catch (e:any) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const { id } = await req.json()
    if (!id) return NextResponse.json({ message: 'id requerido' }, { status: 400 })
    await prisma.poolModel.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}