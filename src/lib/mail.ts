import type { Payload } from 'payload'
import { getEnv } from './env'

export async function sendOtpMail(payload: Payload, to: string, code: string): Promise<void> {
  const env = getEnv()
  if (!env.SMTP_HOST) {
    // Зөвхөн dev: SMTP тохируулаагүй үед консолд. Production-д SMTP заавал (env.ts).
    console.log(`[dev] ${to} -> нэвтрэх код: ${code}`)
    return
  }
  await payload.sendEmail({
    to,
    from: env.MAIL_FROM,
    subject: 'Нэвтрэх код',
    text: `Таны нэвтрэх код: ${code}\n\nКод 10 минут хүчинтэй бөгөөд зөвхөн нэг удаа ашиглагдана. Хэнд ч бүү дамжуул.`,
  })
}
