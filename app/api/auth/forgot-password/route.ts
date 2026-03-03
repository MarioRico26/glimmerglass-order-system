import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/mailer'
import {
  generateRawResetToken,
  hashResetToken,
  isValidEmail,
  RESET_TOKEN_TTL_MS,
} from '@/lib/passwordReset'

export const dynamic = 'force-dynamic'

function okResponse() {
  return NextResponse.json({
    message:
      'If the email exists in our system, password reset instructions will be sent shortly.',
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const email = (body?.email || '').toString().trim().toLowerCase()

    if (!isValidEmail(email)) {
      return okResponse()
    }

    // Security posture:
    // We intentionally return the same response regardless of account existence.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    if (user) {
      const rawToken = generateRawResetToken()
      const tokenHash = hashResetToken(rawToken)
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.deleteMany({ where: { userId: user.id } })
        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        })
      })

      const baseUrl =
        process.env.APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || req.nextUrl.origin
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(user.email)}`

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password for Glimmerglass Order System.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;">
              Reset Password
            </a>
          </p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, you can ignore this email.</p>
        </div>
      `

      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset your Glimmerglass password',
          html,
        })
      } catch (e) {
        console.error('forgot-password sendEmail error:', e)
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[PASSWORD RESET LINK]', resetUrl)
      }
    }

    return okResponse()
  } catch {
    return okResponse()
  }
}
