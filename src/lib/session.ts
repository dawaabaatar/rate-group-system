import { createHash, randomBytes } from 'node:crypto'

export const SESSION_COOKIE = 'rg_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Cookie-д явах санамсаргүй токен. DB-д зөвхөн хэш нь хадгалагдана. */
export const newToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}
