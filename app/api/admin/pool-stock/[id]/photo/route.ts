import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

export const runtime = 'nodejs'

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw Object.assign(
      new Error('Missing BLOB_READ_WRITE_TOKEN environment variable'),
      { status: 500 }
    )
  }
  return token
}

function extFromName(name: string) {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'jpg'
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])

    const exists = await prisma.poolStock.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!exists) {
      return NextResponse.json({ message: 'Pool stock row not found' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ message: 'file is required' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ message: 'image file required' }, { status: 400 })
    }

    const ext = extFromName(file.name)
    const token = getBlobToken()
    const blob = await put(
      `pool-stock/${params.id}/photo-${Date.now()}.${ext}`,
      file,
      { access: 'public', token },
    )

    const item = await prisma.poolStock.update({
      where: { id: params.id },
      data: { imageUrl: blob.url },
      select: { id: true, imageUrl: true },
    })

    return NextResponse.json({ item })
  } catch (e: unknown) {
    const status =
      typeof e === 'object' && e !== null && 'status' in e && typeof e.status === 'number'
        ? e.status
        : 500
    const message =
      typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string'
        ? e.message
        : 'Internal server error'
    return NextResponse.json({ message }, { status })
  }
}
