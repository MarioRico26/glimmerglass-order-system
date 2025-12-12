// app/api/admin/orders/[id]/media/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { MediaType, OrderDocType } from '@prisma/client'
import { put } from '@vercel/blob'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }
async function getOrderId(ctx: Ctx) {
  const p: any = ctx.params
  return ('then' in p ? (await p).id : p.id) as string
}

function noStore() {
  return { 'Cache-Control': 'no-store' }
}

function toBool(v: FormDataEntryValue | null, fallback = true) {
  if (typeof v !== 'string') return fallback
  const s = v.trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false
  return fallback
}

function toMediaTypeFromMime(mime?: string): MediaType {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return MediaType.photo
  return MediaType.update
}

function parseMediaType(v: FormDataEntryValue | null, mimeFallback?: string): MediaType {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'update') return MediaType.update
    if (s === 'proof') return MediaType.proof
    if (s === 'photo') return MediaType.photo
    if (s === 'note') return MediaType.note
  }
  return toMediaTypeFromMime(mimeFallback)
}

function parseDocType(v: FormDataEntryValue | null): OrderDocType | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null

  // Validate against enum values
  const values = Object.values(OrderDocType) as string[]
  return values.includes(s) ? (s as OrderDocType) : null
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: noStore() })
    }

    const orderId = await getOrderId(ctx)

    const items = await prisma.orderMedia.findMany({
      where: { orderId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        fileUrl: true,
        type: true,
        uploadedAt: true,
        docType: true,
        visibleToDealer: true,
      },
    })

    return NextResponse.json(items, { headers: noStore() })
  } catch (e) {
    console.error('GET /api/admin/orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Failed to fetch media' }, { status: 500, headers: noStore() })
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: noStore() })
    }

    const orderId = await getOrderId(ctx)
    const form = await req.formData()

    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ message: 'file is required' }, { status: 400, headers: noStore() })
    }

    const type = parseMediaType(form.get('type'), file.type)
    const docType = parseDocType(form.get('docType'))
    const visibleToDealer = toBool(form.get('visibleToDealer'), true)

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
        type,
        docType, // ✅ new
        visibleToDealer, // ✅ new
      },
      select: {
        id: true,
        orderId: true,
        fileUrl: true,
        type: true,
        uploadedAt: true,
        docType: true,
        visibleToDealer: true,
      },
    })

    return NextResponse.json(media, { status: 201, headers: noStore() })
  } catch (e) {
    console.error('POST /api/admin/orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500, headers: noStore() })
  }
}