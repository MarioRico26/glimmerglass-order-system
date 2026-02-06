import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

export const runtime = 'nodejs'

const ALLOWED = new Set(['image', 'blueprint'])

function extFromName(name: string) {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])

    const formData = await req.formData()
    const type = formData.get('type')?.toString().trim() || ''
    const file = formData.get('file')

    if (!ALLOWED.has(type)) {
      return NextResponse.json({ message: 'type must be image or blueprint' }, { status: 400 })
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ message: 'file is required' }, { status: 400 })
    }

    if (type === 'image' && !file.type.startsWith('image/')) {
      return NextResponse.json({ message: 'image file required' }, { status: 400 })
    }

    if (type === 'blueprint' && file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      return NextResponse.json({ message: 'blueprint must be PDF or image' }, { status: 400 })
    }

    const ext = extFromName(file.name) || (type === 'image' ? 'png' : 'pdf')
    const blob = await put(
      `pool-models/${params.id}/${type}-${Date.now()}.${ext}`,
      file,
      { access: 'public' },
    )

    const data: any = {}
    if (type === 'image') data.imageUrl = blob.url
    if (type === 'blueprint') data.blueprintUrl = blob.url

    const item = await prisma.poolModel.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ item })
  } catch (e: any) {
    const status = e?.status ?? 500
    return NextResponse.json({ message: e?.message ?? 'Internal server error' }, { status })
  }
}
