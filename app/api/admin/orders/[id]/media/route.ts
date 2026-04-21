//glimmerglass-order-system/app/api/admin/orders/[id]/media/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { MediaType, OrderDocType, Role } from '@prisma/client'
import { del, put } from '@vercel/blob'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }
async function getOrderId(ctx: Ctx) {
  const params = ctx.params
  if (typeof (params as Promise<{ id: string }>).then === 'function') {
    return (await (params as Promise<{ id: string }>)).id
  }
  return (params as { id: string }).id
}

function toMediaTypeFromMime(mime?: string): MediaType {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return MediaType.photo
  if (m === 'application/pdf') return MediaType.proof
  return MediaType.update
}

function toBool(v: FormDataEntryValue | null, fallback = true) {
  if (v == null) return fallback
  const s = String(v).toLowerCase()
  return s === 'true' || s === '1' || s === 'on' || s === 'yes'
}

function isAdminRole(role: unknown) {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

function uploaderDisplayNameFor(role?: Role | null, dealerName?: string | null) {
  if (role === Role.SUPERADMIN) return 'Superadmin'
  if (role === Role.ADMIN) return 'Admin'
  if (role === Role.DEALER) return dealerName?.trim() || 'Dealer'
  return 'User'
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }
    if (!isAdminRole((session.user as { role?: unknown }).role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
    }

    const orderId = await getOrderId(ctx)

    const items = await prisma.orderMedia.findMany({
      where: { orderId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileUrl: true,
        type: true,
        docType: true,
        documentDefinition: {
          select: {
            key: true,
          },
        },
        visibleToDealer: true,
        uploadedAt: true,
        uploadedByUserId: true,
        uploadedByRole: true,
        uploadedByDisplayName: true,
        uploadedByEmail: true,
        uploadedByUser: {
          select: {
            email: true,
            role: true,
            dealer: { select: { name: true } },
          },
        },
      },
    })
    const normalizedItems = items.map((item) => {
      const resolvedRole = item.uploadedByRole ?? item.uploadedByUser?.role ?? null
      const resolvedEmail = item.uploadedByEmail ?? item.uploadedByUser?.email ?? null
      const resolvedDisplayName =
        item.uploadedByDisplayName ??
        uploaderDisplayNameFor(resolvedRole, item.uploadedByUser?.dealer?.name)

      return {
        id: item.id,
        fileUrl: item.fileUrl,
        type: item.type,
        docType: item.documentDefinition?.key ?? item.docType,
        visibleToDealer: item.visibleToDealer,
        uploadedAt: item.uploadedAt,
        uploadedByRole: resolvedRole,
        uploadedByDisplayName: resolvedDisplayName,
        uploadedByEmail: resolvedEmail,
      }
    })

    return NextResponse.json(normalizedItems, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Failed to fetch media' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }
    if (!isAdminRole((session.user as { role?: unknown }).role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
    }

    const orderId = await getOrderId(ctx)
    const form = await req.formData()

    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ message: 'file is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    // ✅ IMPORTANT: this is the business category you care about
    const documentKeyRaw = (form.get('documentKey')?.toString() || form.get('docType')?.toString() || '').trim()
    if (!documentKeyRaw) {
      return NextResponse.json(
        { message: 'Document selection is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const documentDefinition = await prisma.workflowDocumentDefinition.findUnique({
      where: { key: documentKeyRaw },
      select: {
        id: true,
        key: true,
        legacyDocType: true,
        visibleToDealerDefault: true,
      },
    })
    if (!documentDefinition) {
      return NextResponse.json(
        { message: 'Invalid document type' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const docType = documentDefinition.legacyDocType ? (documentDefinition.legacyDocType as OrderDocType) : null

    // ✅ dealer visibility
    const visibleToDealer = toBool(form.get('visibleToDealer'), documentDefinition.visibleToDealerDefault)

    const uploader =
      session.user.email
        ? await prisma.user.findUnique({
            where: { email: session.user.email.toLowerCase().trim() },
            include: { dealer: { select: { name: true } } },
          })
        : null

    const uploadedByRole = uploader?.role ?? ((session.user as { role?: Role | null }).role ?? null)
    const uploadedByEmail = uploader?.email ?? session.user.email ?? null
    const uploadedByDisplayName = uploaderDisplayNameFor(uploadedByRole, uploader?.dealer?.name)

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
        type: toMediaTypeFromMime(file.type), // technical type
        docType,                               // legacy business type when applicable
        documentDefinitionId: documentDefinition.id,
        visibleToDealer,
        uploadedByUserId: uploader?.id ?? null,
        uploadedByRole,
        uploadedByDisplayName,
        uploadedByEmail,
      },
      select: {
        id: true,
        fileUrl: true,
        type: true,
        docType: true,
        documentDefinition: {
          select: {
            key: true,
          },
        },
        visibleToDealer: true,
        uploadedAt: true,
        uploadedByRole: true,
        uploadedByDisplayName: true,
        uploadedByEmail: true,
      },
    })

    return NextResponse.json(
      {
        ...media,
        docType: media.documentDefinition?.key ?? media.docType,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('POST /orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }
    if (!isAdminRole((session.user as { role?: unknown }).role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
    }

    const orderId = await getOrderId(ctx)
    const mediaId = req.nextUrl.searchParams.get('mediaId')?.trim()
    if (!mediaId) {
      return NextResponse.json(
        { message: 'mediaId is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const uploader =
      session.user.email
        ? await prisma.user.findUnique({
            where: { email: session.user.email.toLowerCase().trim() },
            select: { id: true, email: true },
          })
        : null

    if (!uploader) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    })

    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const media = await prisma.orderMedia.findFirst({
      where: { id: mediaId, orderId },
      select: {
        id: true,
        fileUrl: true,
        docType: true,
        documentDefinition: {
          select: {
            label: true,
            key: true,
          },
        },
      },
    })

    if (!media) {
      return NextResponse.json(
        { message: 'File not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const removedLabel = media.documentDefinition?.label || media.documentDefinition?.key || media.docType || 'file'

    await prisma.$transaction(async (tx) => {
      await tx.orderMedia.delete({
        where: { id: media.id },
      })

      await tx.orderHistory.create({
        data: {
          orderId,
          status: order.status,
          comment: `Removed document: ${removedLabel}`,
          userId: uploader.id,
        },
      })
    })

    try {
      await del(media.fileUrl, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
    } catch (blobError) {
      console.warn('DELETE /orders/[id]/media blob cleanup warning:', blobError)
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('DELETE /orders/[id]/media error:', e)
    return NextResponse.json({ message: 'Failed to delete media' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
