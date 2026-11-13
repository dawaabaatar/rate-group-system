import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Имэйлийн оронд кодыг барьж авна
const sent: { to: string; code: string }[] = []
vi.mock('@/lib/mail', () => ({
  sendOtpMail: async (_p: unknown, to: string, code: string) => {
    sent.push({ to, code })
  },
}))

import { createSession, destroySession, requestOtp, verifyOtp } from '@/lib/otp-service'
import { SESSION_COOKIE } from '@/lib/session'
import { getTestPayload, resetDb, seedTeam } from './helpers'

let payload: Payload
let d: Awaited<ReturnType<typeof seedTeam>>

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  sent.length = 0
  await resetDb(payload)
  d = await seedTeam(payload)
})

const EMAIL = 's1@school.edu.mn'

async function requestCode(email = EMAIL, ip = '1.1.1.1') {
  const r = await requestOtp(payload, email, ip)
  if (r.status === 'sent' && r.sendMail) await r.sendMail()
  return r
}
/** OTP мөрүүдийг өнгөрсөн болгож cooldown/түгжээг тестэд хүлээлгүй давна */
async function backdate(minutes: number) {
  const { sql } = await import('drizzle-orm')
  await payload.db.drizzle.execute(
    sql`UPDATE rating.otps SET created_at = created_at - make_interval(mins => ${minutes}), updated_at = updated_at - make_interval(mins => ${minutes})`,
  )
}
describe('otp login', () => {
  it('registered user: request, verify, session works', async () => {
    expect((await requestCode()).status).toBe('sent')
    expect(sent).toHaveLength(1)
    const res = await verifyOtp(payload, EMAIL, sent[0].code)
    expect(res).toEqual({ status: 'ok', userId: d.s1.id })

    const token = await createSession(payload, d.s1.id)
    const auth = await payload.auth({ headers: new Headers({ cookie: `${SESSION_COOKIE}=${token}` }) })
    expect(auth.user?.id).toBe(d.s1.id)

    await destroySession(payload, token)
    const after = await payload.auth({ headers: new Headers({ cookie: `${SESSION_COOKIE}=${token}` }) })
    expect(after.user).toBeNull()
  })

  it('a code works only once', async () => {
    await requestCode()
    const { code } = sent[0]
    expect((await verifyOtp(payload, EMAIL, code)).status).toBe('ok')
    expect((await verifyOtp(payload, EMAIL, code)).status).toBe('invalid')
  })

  it('code is bound to the email', async () => {
    await requestCode()
    await requestCode('s2@school.edu.mn', '2.2.2.2')
    const first = sent.find((s) => s.to === EMAIL)!.code
    expect((await verifyOtp(payload, 's2@school.edu.mn', first)).status).toBe('invalid')
  })

  it('unknown users get the same response but no email', async () => {
    const r = await requestCode('nobody@school.edu.mn')
    expect(r.status).toBe('sent')
    expect(sent).toHaveLength(0)
    expect((await verifyOtp(payload, 'nobody@school.edu.mn', '123456')).status).toBe('invalid')
  })

  it('inactive users get no code', async () => {
    await payload.update({ collection: 'users', id: d.s1.id, data: { active: false } })
    await requestCode()
    expect(sent).toHaveLength(0)
  })

  it('locks after 5 wrong codes, even for the right code afterwards', async () => {
    await requestCode()
    const right = sent[0].code
    const wrong = right === '000000' ? '111111' : '000000'
    const results = []
    for (let i = 0; i < 5; i++) results.push(await verifyOtp(payload, EMAIL, wrong))
    expect(results.slice(0, 4).map((r) => r.status)).toEqual(['invalid', 'invalid', 'invalid', 'invalid'])
    expect(results[0]).toMatchObject({ attemptsLeft: 4 })
    expect(results[4].status).toBe('locked')
    expect((await verifyOtp(payload, EMAIL, right)).status).toBe('locked')
    // Түгжигдсэн үед шинэ код авч болохгүй
    await backdate(2)
    expect((await requestOtp(payload, EMAIL, '1.1.1.1')).status).toBe('locked')
    // 15 минутын дараа дахин нээгдэнэ
    await backdate(20)
    expect((await requestCode()).status).toBe('sent')
  })

  it('parallel guesses cannot exceed the attempt limit', async () => {
    await requestCode()
    const right = sent[0].code
    const wrong = right === '000000' ? '111111' : '000000'
    const results = await Promise.all(Array.from({ length: 25 }, () => verifyOtp(payload, EMAIL, wrong)))
    expect(results.filter((r) => r.status === 'invalid').length).toBeLessThanOrEqual(4)
    const { sql } = await import('drizzle-orm')
    const rows = await payload.db.drizzle.execute(sql`SELECT attempts FROM rating.otps`)
    expect(Number(rows.rows[0].attempts)).toBeLessThanOrEqual(5)
    expect((await verifyOtp(payload, EMAIL, right)).status).toBe('locked')
  })

  it('parallel use of a correct code succeeds only once', async () => {
    await requestCode()
    const results = await Promise.all(Array.from({ length: 10 }, () => verifyOtp(payload, EMAIL, sent[0].code)))
    expect(results.filter((r) => r.status === 'ok')).toHaveLength(1)
  })

  it('expired codes are rejected', async () => {
    await requestCode()
    const { sql } = await import('drizzle-orm')
    await payload.db.drizzle.execute(sql`UPDATE rating.otps SET expires_at = now() - interval '1 minute'`)
    expect((await verifyOtp(payload, EMAIL, sent[0].code)).status).toBe('invalid')
  })

  it('malformed codes are rejected without touching the counter', async () => {
    await requestCode()
    expect((await verifyOtp(payload, EMAIL, 'abcdef')).status).toBe('invalid')
    const { sql } = await import('drizzle-orm')
    const rows = await payload.db.drizzle.execute(sql`SELECT attempts FROM rating.otps`)
    expect(Number(rows.rows[0].attempts)).toBe(0)
  })

  it('enforces resend cooldown, per-email and per-IP limits', async () => {
    expect((await requestCode()).status).toBe('sent')
    expect((await requestCode()).status).toBe('cooldown')
    for (let i = 0; i < 4; i++) {
      await backdate(2)
      expect((await requestCode()).status).toBe('sent')
    }
    await backdate(2)
    expect((await requestCode()).status).toBe('rate_limited')

    for (let i = 0; i < 20; i++) await requestCode(`u${i}@school.edu.mn`, '9.9.9.9')
    expect((await requestCode('another@school.edu.mn', '9.9.9.9')).status).toBe('rate_limited')
  })

  it('simultaneous requests for one email create exactly one code', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => requestOtp(payload, EMAIL, '3.3.3.3')))
    expect(results.filter((r) => r.status === 'sent')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'cooldown')).toHaveLength(11)
    const { sql } = await import('drizzle-orm')
    const rows = await payload.db.drizzle.execute(sql`SELECT count(*)::int AS n FROM rating.otps`)
    expect(rows.rows[0].n).toBe(1)
  })

  it('the per-IP cap holds under parallel requests for different emails', async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => requestOtp(payload, `p${i}@school.edu.mn`, '7.7.7.7')),
    )
    expect(results.filter((r) => r.status === 'sent')).toHaveLength(20)
    expect(results.filter((r) => r.status === 'rate_limited')).toHaveLength(10)
  })

  it('stored code is hashed, never plaintext', async () => {
    await requestCode()
    const { sql } = await import('drizzle-orm')
    const rows = await payload.db.drizzle.execute(sql`SELECT code_hash FROM rating.otps`)
    expect(String(rows.rows[0].code_hash)).not.toContain(sent[0].code)
    expect(String(rows.rows[0].code_hash)).toMatch(/^[0-9a-f]{64}$/)
  })
})
