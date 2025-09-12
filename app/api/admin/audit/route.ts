import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    const actor = session?.user as any
    if (!session || !['ADMIN','SUPERADMIN'].includes(actor?.role)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const dealerId = searchParams.get('dealerId') || undefined
    const orderId  = searchParams.get('orderId') || undefined
    const action   = searchParams.get('action') || undefined

    const items = await prisma.auditLog.findMany({
        where: {
            dealerId: dealerId,
            orderId:  orderId,
            action:   action as any || undefined,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    })

    return NextResponse.json({ items })
}