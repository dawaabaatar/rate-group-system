import { cookies } from 'next/headers'
import { assertSameOrigin, getPayloadClient, route } from '@/lib/http'
import { destroySession } from '@/lib/otp-service'
import { SESSION_COOKIE } from '@/lib/session'

export const POST = route(async (req) => {
  assertSameOrigin(req)
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await destroySession(await getPayloadClient(), token)
  jar.delete(SESSION_COOKIE)
  return { ok: true }
})
