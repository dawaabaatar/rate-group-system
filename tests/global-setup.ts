import { execSync } from 'node:child_process'

export default function setup() {
  const uri = process.env.TEST_DATABASE_URI ?? 'postgresql://postgres@localhost:54329/rating_test'
  const dbName = new URL(uri).pathname.replace('/', '')
  // Хөгжүүлэлт/production DB дээр хүснэгт цэвэрлэхээс сэргийлнэ
  if (!dbName.endsWith('test')) throw new Error(`Refusing to run tests on database "${dbName}"`)
  execSync('npx payload migrate', {
    stdio: 'ignore',
    env: {
      ...process.env,
      DATABASE_URI: uri,
      PAYLOAD_SECRET: 'test-payload-secret-test-payload-secret-0000',
      OTP_SECRET: 'test-otp-secret-test-otp-secret-0000000000',
      SERVER_URL: 'http://localhost:3000',
    },
  })
}
