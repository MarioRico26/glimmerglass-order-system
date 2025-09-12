import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

/** Mapeo simple de mime por extensión */
const mimeByExt: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.heic': 'image/heic',
}

export async function GET(
  _req: NextRequest,
  ctx: { params: { slug: string[] } }
) {
  try {
    const { slug } = ctx.params
    if (!Array.isArray(slug) || slug.length === 0) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 })
    }

    // Evitar path traversal
    const fileName = slug.join('/')
    if (fileName.includes('..')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const filePath = path.join(process.cwd(), 'public', 'uploads', fileName)
    const data = await fs.readFile(filePath)

    const ext = path.extname(filePath).toLowerCase()
    const mime = mimeByExt[ext] || 'application/octet-stream'

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': mime,
        // inline para ver en el navegador; quita inline si quieres forzar descarga
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ message: 'File not found' }, { status: 404 })
  }
}