import { cookies } from 'next/headers'
import { z } from 'zod'
import { getEnv } from '@/lib/env'
import { assertSameOrigin, getPayloadClient, HttpError, route } from '@/lib/http'
import { createSession, verifyOtp } from '@/lib/otp-service'
import { SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/session'

const Body = z.object({ email: z.string().max(254), code: z.string().max(10) })

export const POST = route(async (req) => {
  assertSameOrigin(req)
  const { email, code } = Body.parse(await req.json())
  const payload = await getPayloadClient()

  const result = await verifyOtp(payload, email, code)
  if (result.status === 'locked') throw new HttpError(429, 'locked', { retryAfter: result.retryAfter })
  if (result.status === 'invalid') throw new HttpError(401, 'invalid_code', { attemptsLeft: result.attemptsLeft })

  const token = await createSession(payload, result.userId)
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getEnv().isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
  return { ok: true }
})
