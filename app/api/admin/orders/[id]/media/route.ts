// app/api/admin/orders/[id]/media/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma, Prisma } from '@prisma/client' // 👈 importa Prisma para usar el enum
import { put } from '@vercel/blob'

type Ctx =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> }

async function getOrderId(ctx: Ctx) {
  const p: any = ctx.params
  return ('then' in p ? (await p).id : p.id) as string
}

function mimeToMediaType(mime: string | undefined): Prisma.MediaType {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return Prisma.MediaType.IMAGE
  if (m.startsWith('video/')) return Prisma.MediaType.VIDEO
  // ajusta si tu enum tiene otros valores; DOCUMENT suele ser lo más genérico para pdf/doc/xls
  return Prisma.MediaType.DOCUMENT
}

// GET: lista de archivos
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const orderId = await getOrderId(ctx)
    const items = await prisma.orderMedia.findMany({
      where: { orderId },
      orderBy: { uploadedAt: 'desc' }, // ← usa uploadedAt, no createdAt
    })

    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Failed to fetch media' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

// POST: sube a Vercel Blob y guarda registro
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const orderId = await getOrderId(ctx)
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ message: 'file is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    const buf = await file.arrayBuffer()
    const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_')
    const key = `orders/${orderId}/${Date.now()}-${safeName}`

    const { url } = await put(key, buf, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type || 'application/octet-stream',
    })

    // 🔑 mapea MIME → enum Prisma.MediaType
    const mediaType = mimeToMediaType(file.type)

    const media = await prisma.orderMedia.create({
      data: {
        orderId,
        fileUrl: url,                       // ← campo real
        type: mediaType,                    // ← enum válido
        uploadedAt: new Date(),             // ← si tu modelo no lo autogenera
        // si tienes un campo opcional para el nombre, puedes guardar safeName
        // name: safeName,
        // si tu modelo tiene un campo mimeType, puedes guardar file.type
        // mimeType: file.type || 'application/octet-stream',
      },
    })

    return NextResponse.json(media, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('POST /orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}