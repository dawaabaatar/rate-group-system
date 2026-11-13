import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@payload-config': path.resolve(import.meta.dirname, 'src/payload.config.ts'),
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      // Тестүүд зөвхөн нэр нь `test`-ээр төгссөн DB дээр ажиллана (global-setup шалгана)
      DATABASE_URI: process.env.TEST_DATABASE_URI ?? 'postgresql://postgres@localhost:54329/rating_test',
      PAYLOAD_SECRET: 'test-payload-secret-test-payload-secret-0000',
      OTP_SECRET: 'test-otp-secret-test-otp-secret-0000000000',
      SERVER_URL: 'http://localhost:3000',
      MIN_RATERS: '2',
    },
  },
})
