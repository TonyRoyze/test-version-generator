import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig(base, {
  testMatch: 'drive-sync.e2e.ts',
  use: { baseURL: 'http://127.0.0.1:4187', storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:4187', localStorage: [{ name: 'test-parrot:welcomed', value: 'true' }] }] } },
  webServer: {
    command: 'bunx vite --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_GOOGLE_CLIENT_ID: 'e2e' },
  },
})
