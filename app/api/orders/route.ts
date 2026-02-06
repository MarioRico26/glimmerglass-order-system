// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import { AuditAction, Role } from '@prisma/client'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status })
}

/**
 * GET /api/orders
 * Devuelve las órdenes del dealer autenticado.
 * (Admin usa /api/admin/orders, esto es solo lado dealer)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.email) {
      return jsonError('Unauthorized', 401)
    }

    // Cargamos al usuario para saber su dealerId
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { dealer: true },
    })

    if (!dbUser?.dealer) {
      return jsonError('Dealer not found for this user', 403)
    }

    const orders = await prisma.order.findMany({
      where: { dealerId: dbUser.dealer.id },
      orderBy: { createdAt: 'desc' },
      include: {
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        factoryLocation: { select: { name: true } },
      },
    })

    return NextResponse.json(
      orders.map(o => ({
        id: o.id,
        deliveryAddress: o.deliveryAddress,
        status: o.status,
        createdAt: o.createdAt,
        paymentProofUrl: o.paymentProofUrl ?? null,
        poolModel: o.poolModel ? { name: o.poolModel.name } : null,
        color: o.color ? { name: o.color.name } : null,
        factory: o.factoryLocation ? { name: o.factoryLocation.name } : null,
        shippingMethod: o.shippingMethod,
        requestedShipDate: o.requestedShipDate,
        serialNumber: o.serialNumber,
        hardwareSkimmer: o.hardwareSkimmer,
        hardwareAutocover: o.hardwareAutocover,
        hardwareReturns: o.hardwareReturns,
        hardwareMainDrains: o.hardwareMainDrains,
      }))
    )
  } catch (err) {
    console.error('GET /api/orders error:', err)
    return jsonError('Internal Server Error', 500)
  }
}

/**
 * POST /api/orders
 * Crear una nueva orden desde el lado del dealer.
 * Campos esperados (FormData):
 * - poolModelId (string, required)
 * - colorId (string, required)
 * - deliveryAddress (string, required)
 * - notes (string, optional)
 * - shippingMethod ('PICK_UP' | 'QUOTE' | '', optional)
 * - requestedShipDate ('YYYY-MM-DD', opcional, pero si viene debe ser >= 4 semanas adelante)
 * - hardwareSkimmer / hardwareAutocover / hardwareReturns / hardwareMainDrains (on/true/false)
 * - paymentProof (File, required)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.email) {
      return jsonError('Unauthorized', 401)
    }

    // Solo dealers (o admins si quieres permitir pruebas)
    if (user.role !== Role.DEALER && user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) {
      return jsonError('Forbidden', 403)
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { dealer: true },
    })

    if (!dbUser?.dealer) {
      return jsonError('Dealer not found for this user', 403)
    }

    const formData = await req.formData()

    const poolModelId = formData.get('poolModelId')?.toString().trim() || ''
    const colorId = formData.get('colorId')?.toString().trim() || ''
    const deliveryAddress = formData.get('deliveryAddress')?.toString().trim() || ''
    const notes = formData.get('notes')?.toString().trim() || ''
    const shippingMethodRaw = formData.get('shippingMethod')?.toString().trim() || ''
    const requestedShipDateRaw = formData.get('requestedShipDate')?.toString().trim() || ''
    const blueprintMarkersRaw = formData.get('blueprintMarkers')?.toString().trim() || ''

    const hardwareSkimmer = toBool(formData.get('hardwareSkimmer'))
    const hardwareAutocover = toBool(formData.get('hardwareAutocover'))
    const hardwareReturns = toBool(formData.get('hardwareReturns'))
    const hardwareMainDrains = toBool(formData.get('hardwareMainDrains'))

    const paymentProof = formData.get('paymentProof')

    // Validaciones básicas
    if (!poolModelId || !colorId || !deliveryAddress) {
      return jsonError('Missing required fields (poolModelId, colorId, deliveryAddress)', 400)
    }

    if (!(paymentProof instanceof File) || paymentProof.size === 0) {
      return jsonError('Payment proof file is required', 400)
    }

    // Validar shippingMethod si viene
    let shippingMethod: string | null = null
    if (shippingMethodRaw) {
      if (shippingMethodRaw !== 'PICK_UP' && shippingMethodRaw !== 'QUOTE') {
        return jsonError('Invalid shipping method', 400)
      }
      shippingMethod = shippingMethodRaw
    }

    // Validar requestedShipDate (mínimo 4 semanas en el futuro)
    let requestedShipDate: Date | null = null
    if (requestedShipDateRaw) {
      const parsed = new Date(requestedShipDateRaw + 'T00:00:00Z')
      if (Number.isNaN(parsed.getTime())) {
        return jsonError('Invalid requested ship date format', 400)
      }

      const now = new Date()
      const min = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000) // 4 semanas

      if (parsed < min) {
        return jsonError('Requested ship date must be at least 4 weeks in the future', 400)
      }

      requestedShipDate = parsed
    }

    // Parse blueprint markers (optional)
    let blueprintMarkers: Array<{ type: 'skimmer' | 'return'; x: number; y: number }> | null = null
    if (blueprintMarkersRaw) {
      let parsed: any
      try {
        parsed = JSON.parse(blueprintMarkersRaw)
      } catch {
        return jsonError('Invalid blueprint markers JSON', 400)
      }

      if (!Array.isArray(parsed)) {
        return jsonError('Blueprint markers must be an array', 400)
      }

      try {
        const normalized = parsed.map((m) => {
          const type = m?.type
          const x = Number(m?.x)
          const y = Number(m?.y)
          if ((type !== 'skimmer' && type !== 'return') || !Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error('Invalid blueprint marker')
          }
          if (x < 0 || x > 100 || y < 0 || y > 100) {
            throw new Error('Blueprint marker out of range')
          }
          return { type, x, y }
        })

        blueprintMarkers = normalized.length ? normalized : null
      } catch (err: any) {
        return jsonError(err?.message || 'Invalid blueprint marker', 400)
      }
    }

    // Subir comprobante de pago a Vercel Blob
    let paymentProofUrl: string | null = null
    if (paymentProof instanceof File && paymentProof.size > 0) {
      const ext = paymentProof.name.split('.').pop() || 'dat'
      const blob = await put(`orders/payment/${Date.now()}-${dbUser.dealer.id}.${ext}`, paymentProof, {
        access: 'public',
      })
      paymentProofUrl = blob.url
    }

    // Crear orden con status inicial PENDING_PAYMENT_APPROVAL
    const order = await prisma.order.create({
      data: {
        dealerId: dbUser.dealer.id,
        poolModelId,
        colorId,
        deliveryAddress,
        notes: notes || null,
        blueprintMarkers,
        status: 'PENDING_PAYMENT_APPROVAL',
        paymentProofUrl,
        shippingMethod,
        requestedShipDate,
        // Factory la asigna el admin luego
        factoryLocationId: null,

        hardwareSkimmer,
        hardwareAutocover,
        hardwareReturns,
        hardwareMainDrains,
      },
      include: {
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
      },
    })

    // Audit log
    try {
      await auditLog({
        action: AuditAction.ORDER_CREATED,
        message: `Order ${order.id} created by dealer`,
        actor: {
          id: dbUser.id,
          email: dbUser.email,
          role: user.role,
        },
        dealerId: dbUser.dealer.id,
        orderId: order.id,
        meta: {
          shippingMethod,
          requestedShipDate,
          hasPaymentProof: !!paymentProofUrl,
          hardwareSkimmer,
          hardwareAutocover,
          hardwareReturns,
          hardwareMainDrains,
        },
      })
    } catch (e) {
      console.warn('Audit log ORDER_CREATED failed:', (e as any)?.message)
    }

    return NextResponse.json(
      {
        message: 'Order created successfully',
        order: {
          id: order.id,
          status: order.status,
          deliveryAddress: order.deliveryAddress,
          paymentProofUrl: order.paymentProofUrl,
          shippingMethod: order.shippingMethod,
          requestedShipDate: order.requestedShipDate,
          poolModel: order.poolModel ? { name: order.poolModel.name } : null,
          color: order.color ? { name: order.color.name } : null,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST /api/orders error:', err)
    return jsonError('Internal Server Error', 500)
  }
}

/**
 * Convierte valores de FormData en booleano
 * soporta 'on', 'true', '1'
 */
function toBool(v: FormDataEntryValue | null): boolean {
  if (!v) return false
  const s = v.toString().toLowerCase()
  return s === 'on' || s === 'true' || s === '1'
}
