// app/api/admin/orders/[id]/media/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

// GET: SIEMPRE devuelve un array (sin envolver en { items: ... })
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    const items = await prisma.orderMedia.findMany({
      where: { orderId: id },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        type: true,
        fileUrl: true,
        uploadedAt: true,
      },
    })

    return NextResponse.json(items, { status: 200 })
  } catch (e: any) {
    console.error('GET /orders/[id]/media error:', e)
    // Aun en error devolvemos array para no romper el .map del cliente
    return NextResponse.json([], { status: 200 })
  }
}

// POST: subir archivo y registrar media
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type')?.toString() || 'update') as
      | 'update' | 'proof' | 'photo' | 'note'

    if (!file) {
      return NextResponse.json({ message: 'File is required' }, { status: 400 })
    }

    // Guarda archivo en /public/uploads
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const safeName = file.name.replace(/\s+/g, '-')
    const filename = `${Date.now()}-${safeName}`
    const uploadDir = path.join(process.cwd(), 'public/uploads')
    await fs.mkdir(uploadDir, { recursive: true })
    await fs.writeFile(path.join(uploadDir, filename), buffer)

    const fileUrl = `/uploads/${filename}`

    // Inserta registro
    const media = await prisma.orderMedia.create({
      data: {
        orderId: id,
        fileUrl,
        type, // enum: update | proof | photo | note
      },
      select: { id: true, type: true, fileUrl: true, uploadedAt: true },
    })

    return NextResponse.json(media, { status: 201 })
  } catch (e: any) {
    console.error('POST /orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}