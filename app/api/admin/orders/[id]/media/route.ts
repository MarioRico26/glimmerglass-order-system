//glimmerglass-order-system/app/api/admin/orders/[id]/media/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import { requireRole } from '@/lib/requireRole'
import { MediaType, OrderDocType } from '@prisma/client'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }
async function getOrderId(ctx: Ctx) {
  const p: any = ctx.params
  return ('then' in p ? (await p).id : p.id) as string
}

function toBool(v?: string | null) {
  const s = (v ?? '').toLowerCase().trim()
  return s === 'true' || s === '1' || s === 'on' || s === 'yes'
}

// MediaType automático: no más dropdown en UI.
function inferMediaType(mime?: string, docType?: OrderDocType | null): MediaType {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return MediaType.photo

  // si es un docType claramente “proof”, lo guardamos como proof
  if (docType === OrderDocType.PROOF_OF_PAYMENT || docType === OrderDocType.PROOF_OF_FINAL_PAYMENT) {
    return MediaType.proof
  }

  // todo lo demás es “update” (docs internos, checklists, invoices, etc.)
  return MediaType.update
}

function parseDocType(raw?: string | null): OrderDocType | null {
  if (!raw) return null
  // Valida contra el enum real
  const values = Object.values(OrderDocType) as string[]
  return values.includes(raw) ? (raw as OrderDocType) : null
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])
    const orderId = await getOrderId(ctx)

    const items = await prisma.orderMedia.findMany({
      where: { orderId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileUrl: true,
        type: true,
        uploadedAt: true,
        docType: true,
        visibleToDealer: true,
      },
    })

    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/admin/orders/[id]/media error:', e)
    return NextResponse.json(
      { message: 'Failed to fetch media' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])

    const orderId = await getOrderId(ctx)
    const form = await req.formData()

    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json(
        { message: 'file is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const docTypeRaw = form.get('docType')?.toString() ?? null
    const docType = parseDocType(docTypeRaw) // si no matchea, null (OTHER)
    const visibleToDealer = toBool(form.get('visibleToDealer')?.toString())

    const buf = await file.arrayBuffer()
    const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_')
    const key = `orders/${orderId}/${Date.now()}-${safeName}`

    const { url } = await put(key, buf, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type || 'application/octet-stream',
    })

    const mediaType = inferMediaType(file.type, docType)

    const media = await prisma.orderMedia.create({
      data: {
        orderId,
        fileUrl: url,
        type: mediaType,
        docType,
        visibleToDealer,
        uploadedAt: new Date(),
      },
      select: {
        id: true,
        fileUrl: true,
        type: true,
        uploadedAt: true,
        docType: true,
        visibleToDealer: true,
      },
    })

    return NextResponse.json(media, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('POST /api/admin/orders/[id]/media error:', e)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}