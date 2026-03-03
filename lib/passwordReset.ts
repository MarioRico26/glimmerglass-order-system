import { createHash, randomBytes } from 'node:crypto'

const RESET_TOKEN_BYTES = 32
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

function resetSecret() {
  return process.env.PASSWORD_RESET_SECRET || process.env.NEXTAUTH_SECRET || 'reset-dev-secret'
}

export function generateRawResetToken() {
  return randomBytes(RESET_TOKEN_BYTES).toString('hex')
}

export function hashResetToken(rawToken: string) {
  return createHash('sha256').update(`${rawToken}.${resetSecret()}`).digest('hex')
}

export function isValidEmail(email: string) {
  return !!email && email.includes('@') && email.length <= 320
}
