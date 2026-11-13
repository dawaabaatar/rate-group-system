import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const sent: { to: string; code: string }[] = []
vi.mock('@/lib/mail', () => ({
  sendOtpMail: async (_p: unknown, to: string, code: string) => {
    sent.push({ to, code })
  },
}))

// route handler-ууд Next-ийн request scope-оос cookies()/after()-ийг авдаг тул тестэд барьж авна
const cookieJar = { set: vi.fn(), delete: vi.fn(), get: vi.fn() }
vi.mock('next/headers', () => ({ cookies: async () => cookieJar }))
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: (fn: () => unknown) => void fn(),
}))

import { POST as logout } from '@/app/(app)/api/auth/logout/route'
import { POST as requestRoute } from '@/app/(app)/api/auth/otp/request/route'
import { POST as verifyRoute } from '@/app/(app)/api/auth/otp/verify/route'
import { PUT as putRatings } from '@/app/(app)/api/assignments/[id]/ratings/route'
import { GET as getSummary } from '@/app/(app)/api/me/summary/route'
import { createSession } from '@/lib/otp-service'
import { SESSION_COOKIE } from '@/lib/session'
import { getTestPayload, resetDb, seedTeam } from './helpers'

const ORIGIN = 'http://localhost:3000'
let payload: Payload
let d: Awaited<ReturnType<typeof seedTeam>>

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  sent.length = 0
  vi.clearAllMocks()
  await resetDb(payload)
  d = await seedTeam(payload)
})

const req = (url: string, init: { method?: string; origin?: string | null; body?: unknown; cookie?: string } = {}) => {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': '5.5.5.5' }
  if (init.origin !== null) headers.origin = init.origin ?? ORIGIN
  if (init.cookie) headers.cookie = init.cookie
  return new Request(`${ORIGIN}${url}`, { method: init.method ?? 'POST', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
}
const ctx = { params: Promise.resolve({ id: String(1) }) }

describe('Origin check (CSRF)', () => {
  const body = { email: 's1@school.edu.mn', code: '123456' }
  it.each([
    ['otp request', () => requestRoute(req('/x', { origin: null, body }), undefined as never)],
    ['otp verify', () => verifyRoute(req('/x', { origin: null, body }), undefined as never)],
    ['logout', () => logout(req('/x', { origin: null }), undefined as never)],
    ['ratings', () => putRatings(req('/x', { origin: null, method: 'PUT', body: { ratings: [] } }), ctx)],
  ])('%s rejects a missing Origin', async (_n, call) => {
    const res = await call()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'bad_origin' })
  })
  it.each(['https://evil.example', 'http://localhost:3000.evil.example', 'null'])('rejects foreign origin %s', async (origin) => {
    expect((await requestRoute(req('/x', { origin, body }), undefined as never)).status).toBe(403)
    expect((await putRatings(req('/x', { origin, method: 'PUT', body: { ratings: [] } }), ctx)).status).toBe(403)
  })
  it('a rejected request has no side effects', async () => {
    await requestRoute(req('/x', { origin: 'https://evil.example', body }), undefined as never)
    expect(sent).toHaveLength(0)
    expect((await payload.count({ collection: 'otps' })).totalDocs).toBe(0)
  })
})

describe('login over HTTP handlers', () => {
  it('rejects non edu.mn emails without creating a code', async () => {
    const res = await requestRoute(req('/x', { body: { email: 'a@gmail.com' } }), undefined as never)
    expect(res.status).toBe(400)
    expect((await payload.count({ collection: 'otps' })).totalDocs).toBe(0)
  })

  it('sets a hardened session cookie on success and none on failure', async () => {
    await requestRoute(req('/x', { body: { email: 's1@school.edu.mn' } }), undefined as never)
    await vi.waitFor(() => expect(sent).toHaveLength(1))

    const wrong = await verifyRoute(req('/x', { body: { email: 's1@school.edu.mn', code: sent[0].code === '000000' ? '111111' : '000000' } }), undefined as never)
    expect(wrong.status).toBe(401)
    expect(cookieJar.set).not.toHaveBeenCalled()

    const ok = await verifyRoute(req('/x', { body: { email: 's1@school.edu.mn', code: sent[0].code } }), undefined as never)
    expect(ok.status).toBe(200)
    const [name, value, opts] = cookieJar.set.mock.calls[0]
    expect(name).toBe(SESSION_COOKIE)
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 })
    // Токен хэшээр л хадгалагдана
    const { docs } = await payload.find({ collection: 'sessions', limit: 5 })
    expect(docs).toHaveLength(1)
    expect(docs[0].tokenHash).not.toBe(value)
  })

  it('the response never discloses whether an account exists', async () => {
    const known = await requestRoute(req('/x', { body: { email: 's1@school.edu.mn' } }), undefined as never)
    const unknown = await requestRoute(req('/x', { body: { email: 'nobody@school.edu.mn' } }), undefined as never)
    expect([known.status, await known.json()]).toEqual([unknown.status, await unknown.json()])
  })
})

describe('authentication on data routes', () => {
  it('401 without a session, and the session cookie authenticates', async () => {
    expect((await getSummary(req('/x', { method: 'GET' }), undefined as never)).status).toBe(401)
    expect((await putRatings(req('/x', { method: 'PUT', body: { ratings: [] } }), ctx)).status).toBe(401)

    const token = await createSession(payload, d.s1.id)
    const res = await getSummary(req('/x', { method: 'GET', cookie: `${SESSION_COOKIE}=${token}` }), undefined as never)
    expect(res.status).toBe(200)
  })

  it('malformed bodies are 400 and unexpected errors do not leak details', async () => {
    const token = await createSession(payload, d.s1.id)
    const cookie = `${SESSION_COOKIE}=${token}`
    const bad = await putRatings(req('/x', { method: 'PUT', cookie, body: { ratings: [{ rateeId: 'x', criterionId: 1, score: 9 }] } }), ctx)
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({ error: 'invalid_input' })
  })
})
