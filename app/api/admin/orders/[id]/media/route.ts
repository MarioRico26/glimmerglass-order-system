// app/api/admin/orders/[id]/media/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { put } from '@vercel/blob'

type Ctx =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> }

async function getOrderId(ctx: Ctx) {
  const p: any = ctx.params
  return ('then' in p ? (await p).id : p.id) as string
}

// Categoriza el MIME en image / video / doc
function coarseKind(mime: string | undefined): 'image' | 'video' | 'doc' {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  return 'doc'
}

/**
 * Devuelve un valor VÁLIDO del enum MediaType según los valores reales del schema.
 * Si tu enum tiene valores como ['IMAGE', 'VIDEO', 'DOCUMENT'] usará esos.
 * Si tu enum tiene ['IMAGE', 'VIDEO', 'FILE'] o ['PHOTO','VIDEO','DOC'] se adapta.
 */
function pickValidMediaType(mime: string | undefined): any {
  const allowed: string[] =
    (Prisma as any)?.$Enums?.MediaType
      ? Object.values((Prisma as any).$Enums.MediaType)
      : []

  // heurística: escogemos por orden de preferencia dependiendo del tipo
  const kind = coarseKind(mime)
  const tryOrder = kind === 'image'
    ? ['IMAGE', 'PHOTO', 'IMG']
    : kind === 'video'
      ? ['VIDEO', 'VID']
      : ['DOCUMENT', 'DOC', 'FILE', 'OTHER']

  // elige la primera opción que exista en el enum
  for (const candidate of tryOrder) {
    if (allowed.includes(candidate)) return candidate
  }
  // si nada coincide, usa la primera del enum o falla con string genérico
  return allowed[0] ?? 'DOCUMENT'
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
      orderBy: { uploadedAt: 'desc' }, // ⚠️ Usa el campo existente en tu modelo
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

    const enumValue = pickValidMediaType(file.type)

    const media = await prisma.orderMedia.create({
      data: {
        orderId,
        fileUrl: url,
        // 👇 Guardamos un valor válido de tu enum real
        type: enumValue as any,
        uploadedAt: new Date(), // si tu modelo lo tiene con default, puedes omitir
      },
    })

    return NextResponse.json(media, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('POST /orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}