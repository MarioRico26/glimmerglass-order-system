// app/api/admin/orders/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

const SAFE_SORT = new Set(['createdAt', 'status'])
const SAFE_DIR = new Set(['asc', 'desc'])

type OrderStatus =
    | 'PENDING_PAYMENT_APPROVAL'
    | 'APPROVED'
    | 'IN_PRODUCTION'
    | 'COMPLETED'
    | 'CANCELED'

export async function GET(req: NextRequest) {
    try {
        await requireRole(['ADMIN', 'SUPERADMIN'])

        const { searchParams } = new URL(req.url)
        const q = (searchParams.get('q') || '').trim()
        const status = searchParams.get('status') || ''
        const dealer = searchParams.get('dealer') || ''
        const factory = searchParams.get('factory') || ''
        const sort = SAFE_SORT.has(searchParams.get('sort') || '') ? (searchParams.get('sort') as 'createdAt' | 'status') : 'createdAt'
        const dir = SAFE_DIR.has(searchParams.get('dir') || '') ? (searchParams.get('dir') as 'asc' | 'desc') : 'desc'

        const where: any = {}
        if (status) where.status = status
        if (dealer) where.dealer = { name: { equals: dealer } }
        if (factory) where.factoryLocation = { name: { equals: factory } }
        if (q) {
            where.OR = [
                { deliveryAddress: { contains: q, mode: 'insensitive' } },
                { poolModel: { name: { contains: q, mode: 'insensitive' } } },
                { color: { name: { contains: q, mode: 'insensitive' } } },
                { dealer: { name: { contains: q, mode: 'insensitive' } } },
                { factoryLocation: { name: { contains: q, mode: 'insensitive' } } },
                { status: { contains: q, mode: 'insensitive' } },
            ]
        }

        const raw = await prisma.order.findMany({
            where,
            orderBy: { [sort]: dir },
            select: {
                id: true,
                status: true,
                deliveryAddress: true,
                createdAt: true,
                dealer: { select: { name: true, email: true } },
                poolModel: { select: { name: true } },
                color: { select: { name: true } },
                factoryLocation: { select: { name: true } },
            },
        })

        type Row = {
            id: string
            status: OrderStatus
            deliveryAddress: string | null
            createdAt: Date
            updatedAt: Date
            dealerName: string | null
            dealerEmail: string | null
            poolModel: string | null
            color: string | null
            factory: string | null
        }

        const rows: Row[] = raw.map(o => ({
            id: o.id,
            status: o.status as OrderStatus,
            deliveryAddress: o.deliveryAddress ?? null,
            createdAt: o.createdAt,
            updatedAt: o.createdAt, // fallback
            dealerName: o.dealer?.name ?? null,
            dealerEmail: o.dealer?.email ?? null,
            poolModel: o.poolModel?.name ?? null,
            color: o.color?.name ?? null,
            factory: o.factoryLocation?.name ?? null,
        }))

        const header = [
            'Order ID','Status','Delivery Address','Created At','Updated At',
            'Dealer Name','Dealer Email','Pool Model','Color','Factory',
        ].join(',')

        const csvLines = rows.map(r =>
            [
                r.id,
                r.status,
                r.deliveryAddress ?? '',
                r.createdAt.toISOString(),
                r.updatedAt.toISOString(),
                r.dealerName ?? '',
                r.dealerEmail ?? '',
                r.poolModel ?? '',
                r.color ?? '',
                r.factory ?? '',
            ]
                .map(cell => {
                    const value = String(cell)
                    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                        return `"${value.replace(/"/g, '""')}"`
                    }
                    return value
                })
                .join(',')
        )

        const csv = [header, ...csvLines].join('\n')

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="orders-export.csv"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (e) {
        console.error('GET /api/admin/orders/export error:', e)
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}