import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './scripts',
  testMatch: 'auth.e2e.ts',
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4175', serviceWorkers: 'allow' },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4175',
    url: 'http://127.0.0.1:4175',
    env: { VITE_SUPABASE_URL: 'https://auth-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
    reuseExistingServer: false,
  },
})
