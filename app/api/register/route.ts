// glimmerglass-order-system/app/api/register/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import { hash } from 'bcryptjs'
import { Prisma } from '@prisma/client'

async function saveFileToPublicUploads(file: File, prefix: string) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  await fs.mkdir(uploadsDir, { recursive: true })
  const safeName = `${prefix}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`
  const full = path.join(uploadsDir, safeName)
  await fs.writeFile(full, bytes)
  return `/uploads/${safeName}`
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const name = String(formData.get('name') || '').trim()
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const rawPassword = String(formData.get('password') || '')
    const phone = String(formData.get('phone') || '')
    const address = String(formData.get('address') || '')
    const city = String(formData.get('city') || '')
    const state = String(formData.get('state') || '')
    const agreement = formData.get('agreement') as File | null // opcional

    if (!name || !email || !rawPassword || !phone || !address || !city || !state) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 })
    }
    if (rawPassword.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const [existingDealer, existingUser] = await Promise.all([
      prisma.dealer.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { email } }),
    ])
    if (existingDealer || existingUser) {
      return NextResponse.json({ message: 'This email is already registered' }, { status: 409 })
    }

    // Guardar PDF si vino (opcional)
    let agreementUrl: string | null = null
    if (agreement && typeof agreement.name === 'string' && agreement.size > 0) {
      agreementUrl = await saveFileToPublicUploads(agreement, 'dealer-agreement')
    }

    const hashedPassword = await hash(rawPassword, 10)

    await prisma.$transaction(async (tx) => {
      const dealer = await tx.dealer.create({
        data: {
          name,
          email,
          phone,
          address,
          city,
          state,
          agreementUrl, // puede ser null (si firmará digitalmente después)
        },
      })

      await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'DEALER',
          approved: false, // 🔒 queda pendiente de aprobación del admin
          dealerId: dealer.id,
        },
      })
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error: any) {
    console.error('Registration error >>>', {
      name: error?.name,
      code: error?.code,
      meta: error?.meta,
      message: error?.message,
      stack: process.env.NODE_ENV !== 'production' ? error?.stack : undefined,
    })

    if (error?.code === 'P2002') {
      const target = (error as Prisma.PrismaClientKnownRequestError)?.meta?.target as string[] | undefined
      if (target?.includes('email')) {
        return NextResponse.json({ message: 'This email is already registered' }, { status: 409 })
      }
      return NextResponse.json({ message: 'Duplicate value' }, { status: 409 })
    }

    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}