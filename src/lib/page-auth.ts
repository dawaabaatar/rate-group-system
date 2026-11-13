import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayloadClient, type SessionUser } from './http'

/** Server component-д: нэвтрээгүй бол /login руу. */
export async function requirePageUser(): Promise<SessionUser> {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/login')
  return user as SessionUser
}
