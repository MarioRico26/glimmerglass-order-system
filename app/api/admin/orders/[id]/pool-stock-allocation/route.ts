export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'

import { assertFactoryAccess, requireAdminAccess } from '@/lib/adminAccess'
import { prisma } from '@/lib/prisma'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }

async function getOrderId(ctx: Ctx) {
  const params = await Promise.resolve(ctx.params)
  return params.id
}

function json(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

async function getOrderForAllocation(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      poolModelId: true,
      colorId: true,
      factoryLocationId: true,
      serialNumber: true,
      allocatedPoolStockId: true,
      poolModel: { select: { name: true } },
      color: { select: { name: true } },
      factoryLocation: { select: { id: true, name: true } },
      allocatedPoolStock: {
        select: {
          id: true,
          status: true,
          quantity: true,
          serialNumber: true,
          productionDate: true,
          notes: true,
          factory: { select: { id: true, name: true } },
        },
      },
    },
  })
}

function canAllocate(status: string) {
  return status === 'PENDING_PAYMENT_APPROVAL' || status === 'IN_PRODUCTION' || status === 'PRE_SHIPPING'
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const access = await requireAdminAccess(AdminModule.ORDER_LIST)
    const orderId = await getOrderId(ctx)
    const order = await getOrderForAllocation(orderId)
    if (!order) return json('Order not found', 404)
    assertFactoryAccess(access, order.factoryLocationId)

    const candidates = await prisma.poolStock.findMany({
      where: {
        factoryId: order.factoryLocationId ?? undefined,
        poolModelId: order.poolModelId,
        colorId: order.colorId,
        OR: [
          { status: 'READY', quantity: { gt: 0 } },
          ...(order.allocatedPoolStockId ? [{ id: order.allocatedPoolStockId }] : []),
        ],
      },
      orderBy: [{ productionDate: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        status: true,
        quantity: true,
        serialNumber: true,
        productionDate: true,
        notes: true,
        factory: { select: { id: true, name: true } },
      },
    })

    const otherAllocated = await prisma.order.findMany({
      where: {
        allocatedPoolStockId: { in: candidates.map((item) => item.id) },
        NOT: { id: order.id },
      },
      select: {
        id: true,
        allocatedPoolStockId: true,
        dealer: { select: { name: true } },
      },
    })
    const allocationMap = new Map(
      otherAllocated
        .filter((row) => row.allocatedPoolStockId)
        .map((row) => [row.allocatedPoolStockId as string, row]),
    )

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        poolModel: order.poolModel,
        color: order.color,
        factory: order.factoryLocation,
        serialNumber: order.serialNumber,
        allocatedPoolStockId: order.allocatedPoolStockId,
      },
      currentAllocation: order.allocatedPoolStock
        ? {
            id: order.allocatedPoolStock.id,
            status: order.allocatedPoolStock.status,
            quantity: order.allocatedPoolStock.quantity,
            serialNumber: order.allocatedPoolStock.serialNumber,
            productionDate: order.allocatedPoolStock.productionDate?.toISOString() ?? null,
            notes: order.allocatedPoolStock.notes ?? null,
            factory: order.allocatedPoolStock.factory,
          }
        : null,
      canAllocate: canAllocate(order.status),
      candidates: candidates.map((item) => ({
        id: item.id,
        status: item.status,
        quantity: item.quantity,
        serialNumber: item.serialNumber,
        productionDate: item.productionDate?.toISOString() ?? null,
        notes: item.notes ?? null,
        factory: item.factory,
        allocatedToOtherOrder: allocationMap.has(item.id),
        allocatedOrder: allocationMap.has(item.id)
          ? {
              id: allocationMap.get(item.id)!.id,
              dealerName: allocationMap.get(item.id)!.dealer?.name ?? null,
            }
          : null,
      })),
    })
  } catch (e: unknown) {
    const status =
      typeof e === 'object' && e !== null && 'status' in e && typeof (e as any).status === 'number'
        ? (e as any).status
        : 500
    const message =
      typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string'
        ? (e as any).message
        : 'Internal server error'
    return json(message, status)
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const access = await requireAdminAccess(AdminModule.ORDER_LIST)
    const orderId = await getOrderId(ctx)
    const body = (await req.json().catch(() => null)) as { stockId?: string | null } | null
    const stockId = body?.stockId?.trim()
    if (!stockId) return json('stockId is required', 400)

    const order = await getOrderForAllocation(orderId)
    if (!order) return json('Order not found', 404)
    assertFactoryAccess(access, order.factoryLocationId)

    if (!canAllocate(order.status)) {
      return json('Only Needs Deposit, In Production, or Pre-Shipping orders can allocate stock', 400)
    }
    if (!order.factoryLocationId) return json('Order must have a factory before allocating stock', 400)

    const stock = await prisma.poolStock.findUnique({
      where: { id: stockId },
      select: {
        id: true,
        factoryId: true,
        poolModelId: true,
        colorId: true,
        status: true,
        quantity: true,
        serialNumber: true,
      },
    })
    if (!stock) return json('Pool stock row not found', 404)
    assertFactoryAccess(access, stock.factoryId)

    if (stock.factoryId !== order.factoryLocationId || stock.poolModelId !== order.poolModelId || stock.colorId !== order.colorId) {
      return json('Pool stock must match the order factory, model, and color', 400)
    }
    if (stock.status !== 'READY' && stock.id !== order.allocatedPoolStockId) {
      return json('Only READY stock can be allocated to an order', 409)
    }
    if (stock.quantity <= 0) {
      return json('Selected stock row is not available', 409)
    }

    const conflict = await prisma.order.findFirst({
      where: { allocatedPoolStockId: stock.id, NOT: { id: order.id } },
      select: { id: true },
    })
    if (conflict) {
      return json('Selected stock row is already allocated to another order', 409)
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      if (order.allocatedPoolStockId && order.allocatedPoolStockId !== stock.id) {
        const previous = await tx.poolStock.findUnique({
          where: { id: order.allocatedPoolStockId },
          select: { id: true, status: true, serialNumber: true },
        })
        if (previous && previous.status === 'RESERVED') {
          await tx.poolStock.update({
            where: { id: previous.id },
            data: { status: 'READY' },
          })
          await tx.poolStockTxn.create({
            data: {
              stockId: previous.id,
              type: 'RELEASE',
              quantity: 1,
              referenceOrderId: order.id,
              notes: 'Released from order allocation',
            },
          })
        }
      }

      if (order.allocatedPoolStockId !== stock.id) {
        await tx.poolStock.update({
          where: { id: stock.id },
          data: { status: 'RESERVED' },
        })
        await tx.poolStockTxn.create({
          data: {
            stockId: stock.id,
            type: 'RESERVE',
            quantity: 1,
            referenceOrderId: order.id,
            notes: 'Reserved for order allocation',
          },
        })
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          allocatedPoolStockId: stock.id,
          serialNumber: stock.serialNumber ?? order.serialNumber,
        },
        select: {
          id: true,
          allocatedPoolStockId: true,
          serialNumber: true,
        },
      })
    })

    return NextResponse.json({ ok: true, order: updatedOrder })
  } catch (e: unknown) {
    const status =
      typeof e === 'object' && e !== null && 'status' in e && typeof (e as any).status === 'number'
        ? (e as any).status
        : 500
    const message =
      typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string'
        ? (e as any).message
        : 'Internal server error'
    return json(message, status)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const access = await requireAdminAccess(AdminModule.ORDER_LIST)
    const orderId = await getOrderId(ctx)
    const order = await getOrderForAllocation(orderId)
    if (!order) return json('Order not found', 404)
    assertFactoryAccess(access, order.factoryLocationId)

    if (!order.allocatedPoolStockId) {
      return json('Order has no allocated pool stock', 400)
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const stock = await tx.poolStock.findUnique({
        where: { id: order.allocatedPoolStockId! },
        select: { id: true, status: true, serialNumber: true },
      })
      if (stock && stock.status === 'RESERVED') {
        await tx.poolStock.update({
          where: { id: stock.id },
          data: { status: 'READY' },
        })
        await tx.poolStockTxn.create({
          data: {
            stockId: stock.id,
            type: 'RELEASE',
            quantity: 1,
            referenceOrderId: order.id,
            notes: 'Released from order allocation',
          },
        })
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          allocatedPoolStockId: null,
          ...(order.serialNumber && stock?.serialNumber && order.serialNumber === stock.serialNumber
            ? { serialNumber: null }
            : {}),
        },
        select: { id: true, allocatedPoolStockId: true, serialNumber: true },
      })
    })

    return NextResponse.json({ ok: true, order: updatedOrder })
  } catch (e: unknown) {
    const status =
      typeof e === 'object' && e !== null && 'status' in e && typeof (e as any).status === 'number'
        ? (e as any).status
        : 500
    const message =
      typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string'
        ? (e as any).message
        : 'Internal server error'
    return json(message, status)
  }
}
