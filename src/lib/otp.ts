import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000
export const OTP_LOCK_MS = 15 * 60 * 1000
export const OTP_MAX_PER_EMAIL_HOUR = 5
export const OTP_MAX_PER_IP_HOUR = 20

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

/** Түүхий кодыг DB-д хадгалахгүй: имэйлтэй холбосон HMAC. */
export function hashCode(secret: string, email: string, code: string): string {
  return createHmac('sha256', secret).update(`${email}:${code}`).digest('hex')
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && timingSafeEqual(x, y)
}

export function isValidCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code)
}
