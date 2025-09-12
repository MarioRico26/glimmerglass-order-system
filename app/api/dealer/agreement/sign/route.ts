import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { PDFDocument, rgb } from 'pdf-lib'
import path from 'path'
import fs from 'fs/promises'

/**
 * Utilidad simple para almacenar archivos en /public/uploads
 */
async function saveFile(buf: Buffer, filename: string) {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  await fs.mkdir(uploadsDir, { recursive: true })
  const dest = path.join(uploadsDir, filename)
  await fs.writeFile(dest, buf)
  return '/uploads/' + filename
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
    const { signatureDataUrl } = await req.json() as { signatureDataUrl?: string }
    if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
    }

    // 1) Guardar PNG de firma
    const sigBuf = Buffer.from(signatureDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
    const sigUrl = await saveFile(
      sigBuf,
      `dealer-sign-${user.dealerId}-${Date.now()}.png`
    )

    // 2) Cargar PDF plantilla desde /public/sample/...
    const templatePath = path.join(
      process.cwd(),
      'public',
      'sample',
      'Glimmerglass Fiberglass Pools Dealership Agreement - Copy.pdf'
    )
    const pdfBytes = await fs.readFile(templatePath)
    const pdfDoc = await PDFDocument.load(pdfBytes)

    // 3) Incrustar la firma
    const pngImage = await pdfDoc.embedPng(sigBuf)
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]

    // ⚠️ Ajusta coordenadas y tamaño a tu plantilla
    // Sistema de coordenadas: origen en abajo-izquierda
    const sigWidth = 220
    const sigHeight = (pngImage.height / pngImage.width) * sigWidth
    const x = 80        // distancia desde el borde izquierdo
    const y = 120       // distancia desde el borde inferior (firmas suelen ir cerca del pie de página)

    firstPage.drawImage(pngImage, { x, y, width: sigWidth, height: sigHeight })

    // 4) Sello de tiempo y nombre del dealer opcional
    const dealer = await prisma.dealer.findUnique({ where: { id: user.dealerId } })
    const stamp = `Signed by ${dealer?.name || user.email} on ${new Date().toLocaleString()}`
    firstPage.drawText(stamp, { x, y: y - 18, size: 10, color: rgb(0.2,0.2,0.2) })

    const finalPdf = await pdfDoc.save()

    // 5) Guardar PDF final
    const pdfUrl = await saveFile(
      Buffer.from(finalPdf),
      `dealer-agreement-${user.dealerId}-${Date.now()}.pdf`
    )

    // 6) Persistir en Dealer
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