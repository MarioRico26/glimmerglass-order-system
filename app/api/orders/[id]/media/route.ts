// glimmerglass-order-system/app/api/orders/[id]/media/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { buildOrderMediaDownloadName } from '@/lib/orderMediaFiles'

function json(message: string, status = 400) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function uploaderDisplayNameFor(
  role?: Role | null,
  dealerName?: string | null,
  explicitDisplayName?: string | null
) {
  if (explicitDisplayName?.trim()) return explicitDisplayName.trim()
  if (role === Role.SUPERADMIN) return 'Superadmin'
  if (role === Role.ADMIN) return 'Admin'
  if (role === Role.DEALER) return dealerName?.trim() || 'Dealer'
  return 'User'
}

function contentDispositionAttachment(fileName: string) {
  const asciiName = fileName.replace(/["\r\n]/g, '_')
  const encodedName = encodeURIComponent(fileName)
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.email) return json('Unauthorized', 401)
    if (user.role !== Role.DEALER) return json('Forbidden', 403)

    // Load user -> dealer
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { dealer: true },
    })

    if (!dbUser?.dealer) return json('Dealer not found for this user', 403)

    const orderId = params.id
    const mediaId = _req.nextUrl.searchParams.get('mediaId')?.trim()
    const shouldDownload = _req.nextUrl.searchParams.get('download') === '1'

    // Verify order belongs to this dealer
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, dealerId: true },
    })

    if (!order) return json('Order not found', 404)
    if (order.dealerId !== dbUser.dealer.id) return json('Forbidden', 403)

    if (mediaId && shouldDownload) {
      const media = await prisma.orderMedia.findFirst({
        where: {
          id: mediaId,
          orderId,
          visibleToDealer: true,
        },
        select: {
          id: true,
          fileUrl: true,
          docType: true,
          documentDefinition: { select: { key: true } },
        },
      })

      if (!media?.fileUrl) return json('File not found', 404)

      const upstream = await fetch(media.fileUrl, { cache: 'no-store' })
      if (!upstream.ok || !upstream.body) return json('Unable to fetch file', 404)

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
      const fileName = buildOrderMediaDownloadName(
        media.fileUrl,
        media.documentDefinition?.key || media.docType || `order-file-${media.id}`,
        contentType
      )

      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=0, must-revalidate',
          'Content-Disposition': contentDispositionAttachment(fileName),
          'Content-Type': contentType,
        },
      })
    }

    // Return only dealer-visible docs
    const items = await prisma.orderMedia.findMany({
      where: {
        orderId,
        visibleToDealer: true,
      },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileUrl: true,
        type: true, // MediaType (photo/proof/update/note)
        docType: true, // OrderDocType (WARRANTY/MANUAL/etc)
        documentDefinition: {
          select: {
            key: true,
          },
        },
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
      const resolvedDisplayName = uploaderDisplayNameFor(
        resolvedRole,
        item.uploadedByUser?.dealer?.name,
        item.uploadedByDisplayName
      )

      return {
        id: item.id,
        fileUrl: item.fileUrl,
        type: item.type,
        docType: item.documentDefinition?.key ?? item.docType,
        uploadedAt: item.uploadedAt,
        uploadedByRole: resolvedRole,
        uploadedByDisplayName: resolvedDisplayName,
        uploadedByEmail: resolvedEmail,
      }
    })

    return NextResponse.json(normalizedItems, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/orders/[id]/media error:', e)
    return json('Failed to fetch media', 500)
  }
}
