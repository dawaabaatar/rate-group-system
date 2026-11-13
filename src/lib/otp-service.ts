import { and, count, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { getEnv } from './env'
import { normalizeEmail } from './email'
import { sendOtpMail } from './mail'
import {
  generateCode,
  hashCode,
  isValidCodeFormat,
  OTP_LOCK_MS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_EMAIL_HOUR,
  OTP_MAX_PER_IP_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  safeEqualHex,
} from './otp'
import { hashToken, newToken, SESSION_TTL_MS } from './session'

const HOUR = 60 * 60 * 1000
const iso = (ms: number) => new Date(ms).toISOString()
const secondsLeft = (ms: number) => Math.max(1, Math.ceil(ms / 1000))

export type RequestResult =
  | { status: 'sent'; sendMail?: () => Promise<void> }
  | { status: 'cooldown' | 'locked' | 'rate_limited'; retryAfter: number }

/**
 * Код үүсгэнэ. Бүртгэлгүй имэйлд ч мөр бичиж, ижил хариу өгнө (хэрэглэгч илрүүлэхээс сэргийлнэ).
 * Имэйл илгээх нь `sendMail`-ээр буцаагдах бөгөөд дуудагч нь хариу өгсний дараа ажиллуулна (хугацааны ялгаа гарахгүй).
 */
export async function requestOtp(payload: Payload, rawEmail: string, ip?: string): Promise<RequestResult> {
  const env = getEnv()
  const email = normalizeEmail(rawEmail)

  const user = (
    await payload.find({
      collection: 'users',
      where: { and: [{ email: { equals: email } }, { active: { equals: true } }] },
      limit: 1,
      depth: 0,
    })
  ).docs[0]
  const code = generateCode()
  const codeHash = hashCode(env.OTP_SECRET, email, code)

  const t = payload.db.tables.otps
  // Нэг имэйлийн шалгалт + бичилтийг advisory lock-оор цуваа болгоно: зэрэг ирсэн хоёр хүсэлт
  // хоёулаа cooldown-г давж хоёр код илгээх боломжгүй (attempts-ийн атом UPDATE-тэй ижил зарчим).
  const outcome = await payload.db.drizzle.transaction(async (tx): Promise<RequestResult | 'created'> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp:${email}`}))`)
    // IP-ийн хязгаар өөр өөр имэйлээр зэрэг ирсэн хүсэлтээр давагдахгүй байхаар IP-г ч түгжинэ.
    // Дараалал үргэлж имэйл -> IP тул deadlock үүсэхгүй.
    if (ip) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp-ip:${ip}`}))`)
    const now = Date.now()

    const [last] = await tx.select().from(t).where(eq(t.email, email)).orderBy(desc(t.createdAt)).limit(1)
    if (last) {
      if (Number(last.attempts) >= OTP_MAX_ATTEMPTS) {
        const left = OTP_LOCK_MS - (now - Date.parse(String(last.updatedAt)))
        if (left > 0) return { status: 'locked', retryAfter: secondsLeft(left) }
      }
      const cooldown = OTP_RESEND_COOLDOWN_MS - (now - Date.parse(String(last.createdAt)))
      if (cooldown > 0) return { status: 'cooldown', retryAfter: secondsLeft(cooldown) }
    }

    const since = iso(now - HOUR)
    const [perEmail] = await tx.select({ n: count() }).from(t).where(and(eq(t.email, email), gt(t.createdAt, since)))
    const [perIp] = ip
      ? await tx.select({ n: count() }).from(t).where(and(eq(t.ip, ip), gt(t.createdAt, since)))
      : [{ n: 0 }]
    if (perEmail.n >= OTP_MAX_PER_EMAIL_HOUR || perIp.n >= OTP_MAX_PER_IP_HOUR) {
      return { status: 'rate_limited', retryAfter: secondsLeft(HOUR) }
    }

    await tx.insert(t).values({ email, codeHash, expiresAt: iso(now + OTP_TTL_MS), attempts: 0, ip })
    return 'created'
  })

  if (outcome !== 'created') return outcome
  return { status: 'sent', sendMail: user ? () => sendOtpMail(payload, email, code) : undefined }
}

export type VerifyResult =
  | { status: 'ok'; userId: number }
  | { status: 'invalid'; attemptsLeft?: number }
  | { status: 'locked'; retryAfter: number }

/**
 * Кодыг шалгана. Оролдлого нэмэх, "ашиглагдсан" болгох хоёр нь атомар UPDATE
 * тул зэрэг олон хүсэлтээр 5-аас олон таамаглах, нэг кодыг хоёр удаа ашиглах боломжгүй.
 */
export async function verifyOtp(payload: Payload, rawEmail: string, rawCode: string): Promise<VerifyResult> {
  const env = getEnv()
  const email = normalizeEmail(rawEmail)
  if (!isValidCodeFormat(rawCode)) return { status: 'invalid' }

  const doc = (
    await payload.find({
      collection: 'otps',
      where: {
        and: [
          { email: { equals: email } },
          { usedAt: { exists: false } },
          { expiresAt: { greater_than: iso(Date.now()) } },
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      pagination: false,
    })
  ).docs[0]
  if (!doc) return { status: 'invalid' }

  const t = payload.db.tables.otps
  const db = payload.db.drizzle
  const [bumped] = await db
    .update(t)
    .set({ attempts: sql`${t.attempts} + 1`, updatedAt: new Date() })
    .where(and(eq(t.id, doc.id), lt(t.attempts, OTP_MAX_ATTEMPTS), isNull(t.usedAt)))
    .returning({ attempts: t.attempts })
  if (!bumped) return { status: 'locked', retryAfter: secondsLeft(OTP_LOCK_MS) }

  if (!safeEqualHex(hashCode(env.OTP_SECRET, email, rawCode), doc.codeHash)) {
    const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - Number(bumped.attempts))
    return attemptsLeft === 0
      ? { status: 'locked', retryAfter: secondsLeft(OTP_LOCK_MS) }
      : { status: 'invalid', attemptsLeft }
  }

  const [used] = await db
    .update(t)
    .set({ usedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(t.id, doc.id), isNull(t.usedAt)))
    .returning({ id: t.id })
  if (!used) return { status: 'invalid' }

  const user = (
    await payload.find({
      collection: 'users',
      where: { and: [{ email: { equals: email } }, { active: { equals: true } }] },
      limit: 1,
      depth: 0,
    })
  ).docs[0]
  return user ? { status: 'ok', userId: user.id } : { status: 'invalid' }
}

/** Шинэ session. Cookie-д явах токен буцаана; DB-д зөвхөн хэш. Хуучирсан мөрүүдийг цэвэрлэнэ. */
export async function createSession(payload: Payload, userId: number): Promise<string> {
  const token = newToken()
  await payload.create({
    collection: 'sessions',
    data: { user: userId, tokenHash: hashToken(token), expiresAt: iso(Date.now() + SESSION_TTL_MS) },
  })
  const now = iso(Date.now())
  await payload.delete({ collection: 'sessions', where: { expiresAt: { less_than: now } } })
  await payload.delete({ collection: 'otps', where: { expiresAt: { less_than: iso(Date.now() - 24 * HOUR) } } })
  return token
}

export async function destroySession(payload: Payload, token: string): Promise<void> {
  await payload.delete({ collection: 'sessions', where: { tokenHash: { equals: hashToken(token) } } })
}
