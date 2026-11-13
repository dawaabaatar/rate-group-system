import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { Assignments } from './collections/Assignments'
import { Criteria } from './collections/Criteria'
import { Otps } from './collections/Otps'
import { Ratings } from './collections/Ratings'
import { Sessions } from './collections/Sessions'
import { Submissions } from './collections/Submissions'
import { Teams } from './collections/Teams'
import { Terms } from './collections/Terms'
import { Users } from './collections/Users'
import { getEnv } from './lib/env'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const env = getEnv()

export default buildConfig({
  secret: env.PAYLOAD_SECRET,
  editor: lexicalEditor(),
  collections: [Users, Terms, Criteria, Teams, Assignments, Submissions, Ratings, Otps, Sessions],
  // Давхар хамгаалалт: GraphQL хэрэггүй, нээхгүй. Cookie-тэй хүсэлт зөвхөн өөрийн origin-оос.
  graphQL: { disable: true },
  csrf: [env.SERVER_URL],
  cors: [env.SERVER_URL],
  telemetry: false,
  admin: { user: Users.slug },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URI,
      ssl: env.DATABASE_CA ? { ca: env.DATABASE_CA.replace(/\\n/g, '\n') } : undefined,
      // Serverless: instance тутамд цөөн холболт (Supabase pooler-ийн хязгаарт багтаах)
      max: 5,
    },
    // Supabase-ийн PostgREST зөвхөн `public`-ийг ил гаргадаг тул тусдаа схемд хадгална
    schemaName: 'rating',
    // Схемийг migration-оор удирдана (src/migrations)
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  email: env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: 'no-reply@localhost',
        defaultFromName: 'Багийн үнэлгээ',
        // Serverless cold start бүрд SMTP холболт шалгахгүй
        skipVerify: true,
        transportOptions: {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        },
      })
    : undefined,
})
