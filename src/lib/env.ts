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
  if (isProd && !parsed.SMTP_HOST) throw new Error('SMTP_HOST is required in production')
  // 1 үнэлэгчтэй дундаж нь оноог шууд ил болгодог тул 2-оос доош болгохгүй
  cached = { ...parsed, MIN_RATERS: Math.max(2, parsed.MIN_RATERS), isProd }
  return cached
}
