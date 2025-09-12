import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { PDFDocument, rgb } from 'pdf-lib'
import path from 'path'
import fs from 'fs/promises'

// 👇 import dinámico de Blob (evita tree-shaking en entornos no Vercel)
async function saveToBlob(
  buf: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const { put } = await import('@vercel/blob')
  const res = await put(key, buf, {
    access: 'public',
    contentType,
    // usa el token que ya añadiste en Vercel
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return res.url
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!user || user.role !== 'DEALER') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  if (!user.dealerId) {
    return NextResponse.json({ message: 'Dealer not linked' }, { status: 400 })
  }

  try {
    const { signatureDataUrl } = (await req.json()) as { signatureDataUrl?: string }
    if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
    }

    // 1) Firma PNG desde el DataURL (sin escribir disco)
    const sigBuf = Buffer.from(
      signatureDataUrl.replace(/^data:image\/png;base64,/, ''),
      'base64'
    )

    // 2) Subir firma a Blob
    const ts = Date.now()
    const folder = `dealer-agreements/${user.dealerId}`
    const sigKey = `${folder}/signature-${ts}.png`
    const sigUrl = await saveToBlob(sigBuf, sigKey, 'image/png')

    // 3) Cargar la plantilla PDF (lectura SÍ está permitida)
    const templatePath = path.join(
      process.cwd(),
      'public',
      'sample',
      'Glimmerglass Fiberglass Pools Dealership Agreement - Copy.pdf'
    )
    const pdfBytes = await fs.readFile(templatePath)
    const pdfDoc = await PDFDocument.load(pdfBytes)

    // 4) Incrustar firma en la 1a página
    const pngImage = await pdfDoc.embedPng(sigBuf)
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]

    const sigWidth = 220
    const sigHeight = (pngImage.height / pngImage.width) * sigWidth
    const x = 80
    const y = 120

    firstPage.drawImage(pngImage, { x, y, width: sigWidth, height: sigHeight })

    // 5) Sello de tiempo
    const dealer = await prisma.dealer.findUnique({ where: { id: user.dealerId } })
    const stamp = `Signed by ${dealer?.name || user.email} on ${new Date().toLocaleString()}`
    firstPage.drawText(stamp, { x, y: y - 18, size: 10, color: rgb(0.2, 0.2, 0.2) })

    const finalPdf = await pdfDoc.save()

    // 6) Subir PDF final a Blob
    const pdfKey = `${folder}/agreement-${ts}.pdf`
    const pdfUrl = await saveToBlob(Buffer.from(finalPdf), pdfKey, 'application/pdf')

    // 7) Persistir en BD
    await prisma.dealer.update({
      where: { id: user.dealerId },
      data: {
        agreementSignatureUrl: sigUrl,
        agreementUrl: pdfUrl,
        agreementSignedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true, agreementUrl: pdfUrl, signatureUrl: sigUrl })
  } catch (e) {
    console.error('POST /api/dealer/agreement/sign error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}