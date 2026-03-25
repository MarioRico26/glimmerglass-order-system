import { NextResponse } from 'next/server'
import { AdminModule, OrderDocType } from '@prisma/client'

import { requireAdminAccess, scopedFactoryWhere } from '@/lib/adminAccess'
import { prisma } from '@/lib/prisma'

type AlertItem = {
  id: string
  type: 'final-payment' | 'missing-serial' | 'unscheduled-production' | 'unscheduled-shipping'
  title: string
  message: string
  href: string
  createdAt: string
  tone: 'rose' | 'amber' | 'indigo' | 'violet'
}

const activeSerialStatuses = ['IN_PRODUCTION', 'PRE_SHIPPING', 'COMPLETED', 'SERVICE_WARRANTY'] as const

export async function GET() {
  try {
    const access = await requireAdminAccess(AdminModule.DASHBOARD)
    const orderScope = scopedFactoryWhere(access)

    const [finalPaymentNeeded, missingSerial, unscheduledProduction, unscheduledShipping] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...orderScope,
          status: 'PRE_SHIPPING',
          media: { none: { docType: OrderDocType.PROOF_OF_FINAL_PAYMENT } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          createdAt: true,
          dealer: { select: { name: true } },
          poolModel: { select: { name: true } },
          factoryLocation: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          ...orderScope,
          status: { in: activeSerialStatuses as any },
          OR: [{ serialNumber: null }, { serialNumber: '' }],
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          createdAt: true,
          status: true,
          dealer: { select: { name: true } },
          poolModel: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          ...orderScope,
          status: 'IN_PRODUCTION',
          scheduledProductionDate: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          createdAt: true,
          dealer: { select: { name: true } },
          poolModel: { select: { name: true } },
          factoryLocation: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          ...orderScope,
          status: 'PRE_SHIPPING',
          scheduledShipDate: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          createdAt: true,
          dealer: { select: { name: true } },
          poolModel: { select: { name: true } },
          factoryLocation: { select: { name: true } },
        },
      }),
    ])

    const items: AlertItem[] = [
      ...finalPaymentNeeded.map((order) => ({
        id: `final-payment-${order.id}`,
        type: 'final-payment' as const,
        title: 'Final Payment Needed',
        message: `${order.poolModel?.name || 'Order'} • ${order.dealer?.name || 'Unknown dealer'} is Pre-Shipping and still missing proof of final payment.`,
        href: `/admin/orders/${order.id}/history`,
        createdAt: order.createdAt.toISOString(),
        tone: 'rose' as const,
      })),
      ...missingSerial.map((order) => ({
        id: `missing-serial-${order.id}`,
        type: 'missing-serial' as const,
        title: 'Serial Missing',
        message: `${order.poolModel?.name || 'Order'} • ${order.dealer?.name || 'Unknown dealer'} is ${order.status.replaceAll('_', ' ').toLowerCase()} without a serial number.`,
        href: `/admin/orders/${order.id}/history`,
        createdAt: order.createdAt.toISOString(),
        tone: 'amber' as const,
      })),
      ...unscheduledProduction.map((order) => ({
        id: `unscheduled-production-${order.id}`,
        type: 'unscheduled-production' as const,
        title: 'Production Date Missing',
        message: `${order.poolModel?.name || 'Order'} • ${order.dealer?.name || 'Unknown dealer'} is In Production without a scheduled production date.`,
        href: `/admin/production`,
        createdAt: order.createdAt.toISOString(),
        tone: 'indigo' as const,
      })),
      ...unscheduledShipping.map((order) => ({
        id: `unscheduled-shipping-${order.id}`,
        type: 'unscheduled-shipping' as const,
        title: 'Ship Date Missing',
        message: `${order.poolModel?.name || 'Order'} • ${order.dealer?.name || 'Unknown dealer'} is Pre-Shipping without a scheduled ship date.`,
        href: `/admin/shipping`,
        createdAt: order.createdAt.toISOString(),
        tone: 'violet' as const,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 18)

    return NextResponse.json({ items, count: items.length })
  } catch (e: any) {
    const status = e?.status ?? 500
    const message = e?.message ?? 'Internal Server Error'
    return NextResponse.json({ message }, { status })
  }
}
