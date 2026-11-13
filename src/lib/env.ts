import { z } from 'zod'

const schema = z.object({
  DATABASE_URI: z.string().min(1),
  // Supabase-ийн CA сертификат (PEM). Өгвөл серверийн сертификатыг бүрэн шалгана
  DATABASE_CA: z.string().optional(),
  PAYLOAD_SECRET: z.string().min(32),
  OTP_SECRET: z.string().min(32),
  SERVER_URL: z.url(),
  MIN_RATERS: z.coerce.number().int().default(2),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Багийн үнэлгээ <no-reply@localhost>'),
})

export type Env = z.infer<typeof schema> & { isProd: boolean }

let cached: Env | undefined

/** Орчны хувьсагчийг нэг удаа шалгаад хадгална. Дутуу бол эхлэхэд л унана. */
export function getEnv(): Env {
  if (cached) return cached
  const parsed = schema.parse(process.env)
  const isProd = process.env.NODE_ENV === 'production'
  // Vercel preview builds also set NODE_ENV=production. Production deploys still require SMTP.
  if (isProd && process.env.VERCEL_ENV !== 'preview' && !parsed.SMTP_HOST) {
    throw new Error('SMTP_HOST is required in production')
  }
  // 1 үнэлэгчтэй дундаж нь оноог шууд ил болгодог тул 2-оос доош болгохгүй
  cached = { ...parsed, MIN_RATERS: Math.max(2, parsed.MIN_RATERS), isProd }
  return cached
}

/** CSRF-д зөвшөөрөх origin. Preview deploy бүрийн хаяг VERCEL_URL дээр ирдэг. */
export function allowedOrigins(): string[] {
  const origins = new Set<string>([new URL(getEnv().SERVER_URL).origin])
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (host) origins.add(`https://${host}`)
  }
  return [...origins]
}
