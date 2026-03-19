import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { Prisma } from '@prisma/client'

function parseNonNegativeInteger(value: unknown) {
  if (value === null || value === '' || value === undefined) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return NaN
  return n
}

function parseNonNegativeDecimal(value: unknown) {
  if (value === null || value === '' || value === undefined) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return NaN
  return n
}

function poolModelErrorResponse(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2022') {
      return NextResponse.json(
        { message: 'Database schema is out of date for pool models. Run prisma migrate deploy.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ message: e.message }, { status: 400 })
  }
  if (typeof e === 'object' && e !== null) {
    const status = 'status' in e && typeof (e as { status?: unknown }).status === 'number'
      ? (e as { status: number }).status
      : 500
    const message = 'message' in e && typeof (e as { message?: unknown }).message === 'string'
      ? (e as { message: string }).message
      : 'Internal server error'
    return NextResponse.json({ message }, { status })
  }
  return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
}

export async function GET() {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const items = await prisma.poolModel.findMany({
      orderBy: { name: 'asc' },
      include: { defaultFactoryLocation: { select: { id: true, name: true } } },
    })
    return NextResponse.json({ items })
  } catch (e:any) {
    return NextResponse.json({ message: e.message || 'Unauthorized' }, { status: e.status || 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const {
      name,
      lengthFt,
      widthFt,
      depthFt,
      imageUrl,
      blueprintUrl,
      defaultFactoryLocationId,
      hasIntegratedSpa,
      maxSkimmers,
      maxReturns,
      maxMainDrains,
    } = await req.json()
    if (!name) return NextResponse.json({ message: 'name requerido' }, { status: 400 })
    const parsedLength = parseNonNegativeDecimal(lengthFt)
    const parsedWidth = parseNonNegativeDecimal(widthFt)
    const parsedDepth = parseNonNegativeDecimal(depthFt)
    if ([parsedLength, parsedWidth, parsedDepth].some((v) => Number.isNaN(v))) {
      return NextResponse.json(
        { message: 'lengthFt, widthFt and depthFt must be decimal values >= 0' },
        { status: 400 }
      )
    }
    if (parsedLength === null || parsedWidth === null || parsedDepth === null) {
      return NextResponse.json(
        { message: 'lengthFt, widthFt and depthFt are required' },
        { status: 400 }
      )
    }

    const data: any = {
      name,
      lengthFt: parsedLength,
      widthFt: parsedWidth,
      depthFt: parsedDepth,
    }
    if (typeof imageUrl === 'string' && imageUrl.trim() !== '') data.imageUrl = imageUrl.trim()
    if (typeof blueprintUrl === 'string' && blueprintUrl.trim() !== '') data.blueprintUrl = blueprintUrl.trim()
    if (defaultFactoryLocationId === null || defaultFactoryLocationId === '') data.defaultFactoryLocationId = null
    if (typeof defaultFactoryLocationId === 'string' && defaultFactoryLocationId.trim() !== '') {
      data.defaultFactoryLocationId = defaultFactoryLocationId.trim()
    }
    data.hasIntegratedSpa = Boolean(hasIntegratedSpa)

    const numericLimits = [
      ['maxSkimmers', maxSkimmers],
      ['maxReturns', maxReturns],
      ['maxMainDrains', maxMainDrains],
    ] as const
    for (const [key, value] of numericLimits) {
      if (value === null || value === '' || value === undefined) continue
      const n = parseNonNegativeInteger(value)
      if (Number.isNaN(n)) {
        return NextResponse.json({ message: `${key} must be an integer >= 0` }, { status: 400 })
      }
      data[key] = n
    }

    const item = await prisma.poolModel.create({ data })
    return NextResponse.json({ item }, { status: 201 })
  } catch (e: unknown) {
    return poolModelErrorResponse(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ message: 'id requerido' }, { status: 400 })
    if (typeof data.imageUrl === 'string') data.imageUrl = data.imageUrl.trim()
    if (typeof data.blueprintUrl === 'string') data.blueprintUrl = data.blueprintUrl.trim()
    if (typeof data.name === 'string') data.name = data.name.trim()

    const decimalKeys = ['lengthFt', 'widthFt', 'depthFt'] as const
    for (const key of decimalKeys) {
      if (data[key] === undefined) continue
      const n = parseNonNegativeDecimal(data[key])
      if (Number.isNaN(n)) {
        return NextResponse.json({ message: `${key} must be a decimal >= 0` }, { status: 400 })
      }
      if (n === null) {
        // Skip empty values in PATCH so marker limits can be updated without touching dimensions.
        delete data[key]
        continue
      }
      data[key] = n
    }

    if (data.defaultFactoryLocationId === '' || data.defaultFactoryLocationId === null) {
      data.defaultFactoryLocationId = null
    }
    if (typeof data.defaultFactoryLocationId === 'string') {
      data.defaultFactoryLocationId = data.defaultFactoryLocationId.trim()
    }
    if (data.hasIntegratedSpa !== undefined) {
      data.hasIntegratedSpa = Boolean(data.hasIntegratedSpa)
    }

    const limitKeys = ['maxSkimmers', 'maxReturns', 'maxMainDrains'] as const
    for (const key of limitKeys) {
      if (data[key] === undefined) continue
      if (data[key] === null || data[key] === '') {
        data[key] = null
        continue
      }
      const n = parseNonNegativeInteger(data[key])
      if (Number.isNaN(n)) {
        return NextResponse.json({ message: `${key} must be an integer >= 0` }, { status: 400 })
      }
      data[key] = n
    }

    const item = await prisma.poolModel.update({ where: { id }, data })
    return NextResponse.json({ item })
  } catch (e: unknown) {
    return poolModelErrorResponse(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireRole(['ADMIN','SUPERADMIN'])
    const { id } = await req.json()
    if (!id) return NextResponse.json({ message: 'id requerido' }, { status: 400 })
    await prisma.poolModel.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return poolModelErrorResponse(e)
  }
}
