export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

type Ctx =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> }

async function getOrderId(ctx: Ctx) {
  const p: any = ctx.params
  return ('then' in p ? (await p).id : p.id) as string
}

// GET: lista de media del pedido
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const orderId = await getOrderId(ctx)
    const items = await prisma.orderMedia.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Failed to fetch media' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

// POST: sube archivo a Vercel Blob y guarda en DB
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const orderId = await getOrderId(ctx)
    const form = await req.formData()
    const file = form.get('file') as File | null
    const label = (form.get('label') as string) || null

    if (!file) {
      return NextResponse.json({ message: 'file is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    const buf = await file.arrayBuffer()
    const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_')
    const key = `orders/${orderId}/${Date.now()}-${safeName}`

    const { url } = await put(key, buf, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,       // <-- ya lo tienes en Vercel
      contentType: file.type || 'application/octet-stream',
    })

    const media = await prisma.orderMedia.create({
      data: {
        orderId,
        url,
        fileName: file.name || safeName,
        contentType: file.type || 'application/octet-stream',
        size: file.size ?? 0,
        label,
        uploadedByEmail: session.user.email ?? null, // ajusta si tu schema usa userId
      },
    })

    return NextResponse.json(media, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('POST /orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}