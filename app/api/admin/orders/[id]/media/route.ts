// app/api/admin/orders/[id]/media/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { put } from '@vercel/blob'
import { MediaType, OrderDocType } from '@prisma/client'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }

async function getOrderId(ctx: Ctx) {
  const p: any = (ctx as any).params
  return ('then' in p ? (await p).id : p.id) as string
}

function toMediaTypeFromMime(mime?: string): MediaType {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return MediaType.photo
  return MediaType.update
}

function parseMediaType(input: unknown, fallback: MediaType): MediaType {
  const v = (typeof input === 'string' ? input : '').trim().toLowerCase()
  if (v === 'photo') return MediaType.photo
  if (v === 'proof') return MediaType.proof
  if (v === 'note') return MediaType.note
  if (v === 'update') return MediaType.update
  return fallback
}

function parseDocType(input: unknown): OrderDocType | null {
  if (typeof input !== 'string') return null
  const v = input.trim()
  if (!v) return null
  // valida contra enum runtime
  return (Object.values(OrderDocType) as string[]).includes(v) ? (v as OrderDocType) : null
}

function parseVisible(input: unknown): boolean {
  if (typeof input === 'boolean') return input
  if (typeof input !== 'string') return true
  const v = input.trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false
  return true
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

    const formType = form.get('type')
    const formDocType = form.get('docType')
    const formVisible = form.get('visibleToDealer')

    const fallbackType = toMediaTypeFromMime(file.type)
    const mediaType = parseMediaType(formType, fallbackType)
    const docType = parseDocType(formDocType)
    const visibleToDealer = parseVisible(formVisible)

    const buf = await file.arrayBuffer()
    const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_')
    const key = `orders/${orderId}/${Date.now()}-${safeName}`

    const { url } = await put(key, buf, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type || 'application/octet-stream',
    })

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