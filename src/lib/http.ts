import { getPayload } from 'payload'
import config from '@payload-config'
import { ZodError } from 'zod'
import type { User } from '@/payload-types'
import { allowedOrigins } from './env'

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public extra?: Record<string, unknown>,
  ) {
    super(code)
  }
}

export type SessionUser = User & { collection: 'users' }

export const getPayloadClient = () => getPayload({ config })

/** X-Forwarded-For-д зөвхөн платформын proxy (Vercel гэх мэт) найдвартай. IP хязгаар нь нэмэлт давхарга. */
export function clientIp(req: Request): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('x-real-ip') || undefined
}

/** CSRF: cookie-тэй өөрчлөх хүсэлт зөвхөн манай origin-оос ирнэ. */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin')
  if (!origin || !allowedOrigins().includes(origin)) throw new HttpError(403, 'bad_origin')
}

export async function requireUser(req: Request): Promise<SessionUser> {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) throw new HttpError(401, 'unauthenticated')
  return user as SessionUser
}

/** Route handler-ийн нэгдсэн алдааны боловсруулалт: дотоод мэдээлэл гадагш гаргахгүй. */
export function route<C>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const result = await fn(req, ctx)
      return result instanceof Response ? result : Response.json(result)
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.code, ...err.extra }, { status: err.status })
      }
      if (err instanceof ZodError) return Response.json({ error: 'invalid_input' }, { status: 400 })
      console.error('[route] unexpected error', err)
      return Response.json({ error: 'server_error' }, { status: 500 })
    }
  }
}
