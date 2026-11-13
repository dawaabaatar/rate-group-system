import type { AuthStrategy } from 'payload'
import { hashToken, readCookie, SESSION_COOKIE } from './session'

/**
 * Payload-ийн auth strategy: cookie дахь токены хэшээр `sessions` хүснэгтээс хэрэглэгчийг олно.
 * Admin самбар, `payload.auth()` бүгд үүнийг ашиглана.
 */
export const sessionStrategy: AuthStrategy = {
  name: 'rg-session',
  authenticate: async ({ payload, headers }) => {
    const token = readCookie(headers.get('cookie'), SESSION_COOKIE)
    if (!token) return { user: null }

    const found = await payload.find({
      collection: 'sessions',
      where: {
        and: [
          { tokenHash: { equals: hashToken(token) } },
          { expiresAt: { greater_than: new Date().toISOString() } },
        ],
      },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const user = found.docs[0]?.user
    if (!user || typeof user !== 'object' || !user.active) return { user: null }
    return { user: { ...user, collection: 'users', _strategy: 'rg-session' } }
  },
}
