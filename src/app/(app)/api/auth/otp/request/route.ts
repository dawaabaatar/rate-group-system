import { after } from 'next/server'
import { z } from 'zod'
import { isEduMnEmail, normalizeEmail } from '@/lib/email'
import { getEnv } from '@/lib/env'
import { assertSameOrigin, clientIp, getPayloadClient, HttpError, route } from '@/lib/http'
import { requestOtp } from '@/lib/otp-service'

const Body = z.object({ email: z.string().max(254) })

export const POST = route(async (req) => {
  assertSameOrigin(req)
  const email = normalizeEmail(Body.parse(await req.json()).email)
  if (!isEduMnEmail(email)) throw new HttpError(400, 'invalid_domain')
  if (getEnv().isProd && !getEnv().SMTP_HOST) throw new HttpError(503, 'mail_unavailable')

  const result = await requestOtp(await getPayloadClient(), email, clientIp(req))
  if (result.status !== 'sent') throw new HttpError(429, result.status, { retryAfter: result.retryAfter })

  // Имэйлийг хариу өгсний дараа илгээнэ: бүртгэлтэй/бүртгэлгүй имэйлийн хариуны хугацаа адил
  const send = result.sendMail
  if (send) after(() => send().catch((e: Error) => console.error('[otp] mail failed:', e.message)))
  return { ok: true }
})
