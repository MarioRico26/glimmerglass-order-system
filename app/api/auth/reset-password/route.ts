import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { hashResetToken, isValidEmail } from '@/lib/passwordReset'

export const dynamic = 'force-dynamic'

function invalidLink() {
  return NextResponse.json(
    { valid: false, message: 'Invalid or expired reset link.' },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

async function getActiveResetToken(email: string, rawToken: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  })
  if (!user) return null

  const tokenHash = hashResetToken(rawToken)
  const row = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true },
  })

  if (!row) return null
  return { user, token: row }
}

export async function GET(req: NextRequest) {
  try {
    const token = (req.nextUrl.searchParams.get('token') || '').trim()
    const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
    if (!token || !isValidEmail(email)) return invalidLink()

    const found = await getActiveResetToken(email, token)
    if (!found) return invalidLink()

    return NextResponse.json(
      { valid: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('GET /api/auth/reset-password error:', e)
    return invalidLink()
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { token?: unknown; email?: unknown; password?: unknown; confirmPassword?: unknown }
      | null

    const token = (body?.token || '').toString().trim()
    const email = (body?.email || '').toString().trim().toLowerCase()
    const password = (body?.password || '').toString()
    const confirmPassword = (body?.confirmPassword || '').toString()

    if (!token || !isValidEmail(email)) {
      return NextResponse.json({ message: 'Invalid or expired reset link.' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ message: 'Passwords do not match.' }, { status: 400 })
    }

    const found = await getActiveResetToken(email, token)
    if (!found) {
      return NextResponse.json({ message: 'Invalid or expired reset link.' }, { status: 400 })
    }

    const passwordHash = await hash(password, 12)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: found.user.id },
        data: { password: passwordHash },
      })
      await tx.passwordResetToken.update({
        where: { id: found.token.id },
        data: { usedAt: new Date() },
      })
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: found.user.id,
          id: { not: found.token.id },
        },
      })
    })

    return NextResponse.json(
      { message: 'Your password has been reset successfully.' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('POST /api/auth/reset-password error:', e)
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 })
  }
}
