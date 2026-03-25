export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'

import { formatDateOnlyForDisplay } from '@/lib/dateOnly'
import { displayInvoiceRef } from '@/lib/invoiceRef'
import { normalizeOrderStatus } from '@/lib/orderFlow'
import { requireAdminAccess, scopedFactoryWhere } from '@/lib/adminAccess'
import { prisma } from '@/lib/prisma'

const SAFE_SORT = new Set([
  'createdAt',
  'requestedShipDate',
  'scheduledShipDate',
  'scheduledProductionDate',
  'productionPriority',
  'status',
])
const SAFE_DIR = new Set(['asc', 'desc'])

function csvCell(value: unknown) {
  const text = String(value ?? '')
  if (text.includes(',') || text.includes('\n') || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function shippingMethodLabel(value?: string | null) {
  if (value === 'PICK_UP') return 'Pick Up'
  if (value === 'QUOTE') return 'Glimmerglass Freight (quote to be provided)'
  return ''
}

function linkedJobTypeLabel(order: {
  jobId?: string | null
  jobItemType?: string | null
}) {
  if (!order.jobId) {
    return order.jobItemType === 'SPA' ? 'Standalone Spa' : 'Standalone Pool'
  }
  return order.jobItemType === 'SPA' ? 'Linked Spa' : 'Linked Pool'
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireAdminAccess(AdminModule.ORDER_LIST)

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const status = searchParams.get('status') || ''
    const dealer = searchParams.get('dealer') || ''
    const factory = searchParams.get('factory') || ''
    const finalPaymentFilter = searchParams.get('finalPayment') || ''
    const signalFilter = searchParams.get('signal') || ''
    const sort = SAFE_SORT.has(searchParams.get('sort') || '')
      ? (searchParams.get('sort') as
          | 'createdAt'
          | 'requestedShipDate'
          | 'scheduledShipDate'
          | 'scheduledProductionDate'
          | 'productionPriority'
          | 'status')
      : 'createdAt'
    const dir = SAFE_DIR.has(searchParams.get('dir') || '')
      ? (searchParams.get('dir') as 'asc' | 'desc')
      : 'desc'

    const where: Record<string, unknown> = {
      ...scopedFactoryWhere(access),
    }

    if (status) {
      where.status = status === 'IN_PRODUCTION' ? { in: ['IN_PRODUCTION', 'APPROVED'] } : status
    }
    if (dealer) {
      where.dealer = { name: { equals: dealer } }
    }
    if (factory) {
      where.factoryLocation = { name: { equals: factory } }
    }
    if (finalPaymentFilter === 'NEEDED') {
      where.status = 'PRE_SHIPPING'
      where.media = { none: { docType: 'PROOF_OF_FINAL_PAYMENT' } }
    } else if (finalPaymentFilter === 'RECEIVED') {
      where.status = 'PRE_SHIPPING'
      where.media = { some: { docType: 'PROOF_OF_FINAL_PAYMENT' } }
    }
    if (signalFilter === 'MISSING_SERIAL') {
      where.AND = [...((where.AND as unknown[]) || []), { OR: [{ serialNumber: null }, { serialNumber: '' }] }]
    } else if (signalFilter === 'UNSCHEDULED_PRODUCTION') {
      where.AND = [
        ...((where.AND as unknown[]) || []),
        { status: { in: ['IN_PRODUCTION', 'APPROVED'] } },
        { scheduledProductionDate: null },
      ]
    } else if (signalFilter === 'UNSCHEDULED_SHIPPING') {
      where.AND = [...((where.AND as unknown[]) || []), { status: 'PRE_SHIPPING' }, { scheduledShipDate: null }]
    } else if (signalFilter === 'NEEDS_DEPOSIT_FILE') {
      where.AND = [
        ...((where.AND as unknown[]) || []),
        { status: 'PENDING_PAYMENT_APPROVAL' },
        { OR: [{ paymentProofUrl: null }, { paymentProofUrl: '' }] },
      ]
    } else if (signalFilter === 'ALLOCATED_STOCK') {
      where.AND = [...((where.AND as unknown[]) || []), { allocatedPoolStockId: { not: null } }]
    }
    if (q) {
      where.OR = [
        { deliveryAddress: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { dealer: { name: { contains: q, mode: 'insensitive' } } },
        { poolModel: { name: { contains: q, mode: 'insensitive' } } },
        { color: { name: { contains: q, mode: 'insensitive' } } },
        { factoryLocation: { name: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const rows = await prisma.order.findMany({
      where,
      orderBy: { [sort]: dir },
      select: {
        id: true,
        status: true,
        deliveryAddress: true,
        notes: true,
        createdAt: true,
        requestedShipDate: true,
        requestedShipAsap: true,
        scheduledShipDate: true,
        scheduledProductionDate: true,
        productionPriority: true,
        shippingMethod: true,
        serialNumber: true,
        invoiceNumber: true,
        jobId: true,
        jobItemType: true,
        dealer: { select: { name: true, email: true } },
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        factoryLocation: { select: { name: true } },
        allocatedPoolStock: {
          select: {
            id: true,
            serialNumber: true,
          },
        },
        job: {
          select: {
            orders: {
              select: { id: true },
            },
          },
        },
        media: {
          where: { docType: 'PROOF_OF_FINAL_PAYMENT' },
          take: 1,
          select: { id: true },
        },
      },
    })

    const header = [
      'Order ID',
      'Status',
      'Job Type',
      'Linked Job',
      'Job Pieces',
      'Dealer Name',
      'Dealer Email',
      'Pool Model',
      'Color',
      'Factory',
      'Delivery Address',
      'Notes',
      'Order Date',
      'Requested Ship Date',
      'Requested Ship ASAP',
      'Scheduled Production Date',
      'Scheduled Ship Date',
      'Shipping Method',
      'Serial Number',
      'Invoice #',
      'Invoice Reference',
      'Production Priority',
      'Final Payment Needed',
      'Allocated Stock',
      'Allocated Stock Serial',
    ].join(',')

    const csvLines = rows.map((order) => {
      const normalizedStatus = normalizeOrderStatus(order.status)?.toString() ?? order.status
      const finalPaymentNeeded = normalizedStatus === 'PRE_SHIPPING' && order.media.length === 0
      return [
        order.id,
        normalizedStatus,
        linkedJobTypeLabel(order),
        order.jobId ? 'Yes' : 'No',
        order.job?.orders.length ?? 0,
        order.dealer?.name ?? '',
        order.dealer?.email ?? '',
        order.poolModel?.name ?? '',
        order.color?.name ?? '',
        order.factoryLocation?.name ?? '',
        order.deliveryAddress ?? '',
        order.notes ?? '',
        order.createdAt.toISOString(),
        formatDateOnlyForDisplay(order.requestedShipDate),
        order.requestedShipAsap ? 'Yes' : 'No',
        formatDateOnlyForDisplay(order.scheduledProductionDate),
        formatDateOnlyForDisplay(order.scheduledShipDate),
        shippingMethodLabel(order.shippingMethod),
        order.serialNumber ?? '',
        order.invoiceNumber ?? '',
        displayInvoiceRef(order.invoiceNumber, order.id, order.createdAt),
        order.productionPriority ?? '',
        finalPaymentNeeded ? 'Yes' : 'No',
        order.allocatedPoolStock ? 'Yes' : 'No',
        order.allocatedPoolStock?.serialNumber ?? order.allocatedPoolStock?.id ?? '',
      ]
        .map(csvCell)
        .join(',')
    })

    const csv = [header, ...csvLines].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=\"orders-export.csv\"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('GET /api/admin/orders/export error:', e)
    const message =
      typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string'
        ? (e as any).message
        : 'Internal Server Error'
    const status =
      typeof e === 'object' && e !== null && 'status' in e && typeof (e as any).status === 'number'
        ? (e as any).status
        : 500
    return NextResponse.json({ message }, { status })
  }
}
