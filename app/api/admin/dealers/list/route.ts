// app/api/admin/dealers/list/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

export async function GET() {
    try {
        await requireRole(['ADMIN', 'SUPERADMIN'])
        const items = await prisma.dealer.findMany({
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' },
        })
        return NextResponse.json({ items }, { status: 200 })
    } catch (e) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
}