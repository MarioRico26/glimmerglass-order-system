// app/api/dealer/docs/tax/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    const u = session?.user as any
    if (!u || u.role !== 'DEALER' || !u.dealerId) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ message: 'File is required' }, { status: 400 })
    if (!file.type.includes('pdf')) {
        return NextResponse.json({ message: 'Only PDF is allowed' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadDir, { recursive: true })
    const safeName = file.name.replace(/\s+/g, '-')
    const filename = `${Date.now()}-${safeName}`
    await fs.writeFile(path.join(uploadDir, filename), bytes)
    const url = `/uploads/${filename}`

    await prisma.dealer.update({
        where: { id: u.dealerId },
        data: { taxDocUrl: url }
    })

    return NextResponse.json({ ok: true, url })
}