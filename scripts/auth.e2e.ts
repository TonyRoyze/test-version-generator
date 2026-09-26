import { test, expect, type Page } from '@playwright/test'

const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'teacher@example.test', aud: 'authenticated', role: 'authenticated', created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} }
const session = () => ({ access_token: 'test-access', refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user })
async function mockAuth(page: Page) {
  await page.route('https://auth-test.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 200, headers })
    if (url.pathname.includes('/token')) {
      const credentials = request.postDataJSON()
      if (credentials.password === 'wrong-password') return route.fulfill({ status: 400, headers, json: { code: 'invalid_credentials', msg: 'Invalid login credentials' } })
      return route.fulfill({ status: 200, headers, json: session() })
    }
    if (url.pathname.includes('/user')) return route.fulfill({ status: 200, headers, json: user })
    if (url.pathname.includes('/account_heads')) return route.fulfill({ status: 200, headers, body: 'null' })
    return route.fulfill({ status: 200, headers, json: {} })
  })
}
async function login(page: Page) {
  await page.goto('/settings')
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('correct-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Signed in as')).toBeVisible()
}

test('private routes require login, invalid credentials show an error, and sign-out restores the gate', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/question-banks')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download backup' })).toHaveCount(0)
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid login credentials')
  await login(page)
  await page.reload()
  await expect(page.getByText(user.email, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download backup' })).toHaveCount(0)
})

test('reset requests return to Settings and do not disclose whether an account exists', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  const request = page.waitForRequest(request => request.url().includes('/recover'))
  await page.getByRole('button', { name: 'Send reset link' }).click()
  expect(new URL((await request).url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4175/settings')
  await expect(page.getByRole('status')).toContainText('If this email belongs to an account')
})

test('invitation links let the invited user set a password before opening the workspace', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/settings#access_token=test-access&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=invite')
  await page.getByLabel('New password', { exact: true }).fill('a-new-password')
  await page.getByLabel('Confirm password').fill('does-not-match')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByRole('alert')).toContainText('passwords do not match')
  await page.getByLabel('Confirm password').fill('a-new-password')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('Signed in as')).toBeVisible()
})

test('concurrent cloud saves expose recovery choices rather than overwriting', async ({ page }) => {
  await mockAuth(page)
  await login(page)
  const head = { owner_id: user.id, revision: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', object_path: `${user.id}/other.zip`, updated_at: new Date().toISOString() }
  await page.route('**/rest/v1/account_heads*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(head) }))
  await page.getByRole('button', { name: 'Sync now' }).click()
  await expect(page.getByRole('heading', { name: 'Another device has saved changes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download this device’s copy' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replace this device with cloud copy' })).toBeVisible()
})

test('sync restores a bank and its image in a fresh browser account', async ({ page, browser }) => {
  let head: Record<string, unknown> | null = null
  let archive: Buffer | null = null
  const cloud = async (target: Page) => {
    await mockAuth(target)
    await target.route('**/rest/v1/account_heads*', async route => {
      if (route.request().method() === 'POST' || route.request().method() === 'PATCH') head = route.request().postDataJSON()
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(head) })
    })
    await target.route('**/storage/v1/object/**', async route => {
      if (route.request().method() === 'POST' && !route.request().url().includes('/authenticated/')) {
        // supabase-js wraps browser Blobs in multipart form data.
        const request = route.request()
        const form = await new Response(request.postDataBuffer(), { headers: { 'content-type': request.headers()['content-type']! } }).formData()
        const file = [...form.values()].find(value => typeof value !== 'string') as File
        archive = Buffer.from(await file.arrayBuffer())
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
      await route.fulfill({ status: 200, contentType: 'application/zip', body: archive! })
    })
  }
  await cloud(page)
  await login(page)
  const src = await page.evaluate(async () => {
    const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts')
    const { saveImage } = await import(/* @vite-ignore */ '/src/local-images.ts')
    const canvas = new OffscreenCanvas(4, 3)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#9f5037'; context.fillRect(0, 0, 4, 3)
    const src = await saveImage(await canvas.convertToBlob({ type: 'image/png' }))
    const banks = createQuestionBankWorkspaceService()
    const bank = await banks.create()
    await banks.commit(bank.id, { kind: 'rename', name: 'Cloud Biology Bank' })
    await banks.commit(bank.id, { kind: 'create-question', question: {
      id: crypto.randomUUID(), type: 'open', columns: 1, topics: [],
      doc: { type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Label the cell.' }] },
        { type: 'image', attrs: { src, alt: 'Cell diagram', title: '' } },
      ] },
    } })
    return src
  })
  await page.getByRole('button', { name: 'Sync now' }).click()
  await expect(page.getByRole('status')).toContainText('Your work is saved to the cloud.')
  await expect(page.getByRole('button', { name: 'Where your work is stored: Synced to cloud', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts')
    const banks = createQuestionBankWorkspaceService()
    const [bank] = await banks.recent()
    await banks.commit(bank.id, { kind: 'rename', name: 'Cloud Biology Bank — updated' })
  })
  await page.getByRole('button', { name: /^Where your work is stored:/ }).click()
  await expect(page.getByRole('region', { name: 'Where your work is stored' })).toContainText('Changes not synced')
  await page.getByRole('button', { name: /^Where your work is stored:/ }).click()
  await page.getByRole('button', { name: 'Sync now' }).click()
  await expect(page.getByRole('button', { name: 'Where your work is stored: Synced to cloud', exact: true })).toBeVisible()
  expect(archive).not.toBeNull()
  const fresh = await browser.newContext({ baseURL: 'http://127.0.0.1:4175' })
  try {
    const other = await fresh.newPage()
    await cloud(other)
    await login(other)
    await other.goto('/question-banks')
    await expect(other.getByText('Cloud Biology Bank — updated', { exact: true }).first()).toBeVisible()
    // The same image URL used by editor/preview/export resolves from restored private media.
    const media = await other.evaluate(async src => {
      const response = await fetch(src)
      const image = await createImageBitmap(await response.blob())
      return { status: response.status, width: image.width, height: image.height }
    }, src)
    expect(media).toEqual({ status: 200, width: 4, height: 3 })
  } finally { await fresh.close() }
})

test('imports pre-login browser work without removing the original', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts')
    const banks = createQuestionBankWorkspaceService()
    const bank = await banks.create()
    await banks.commit(bank.id, { kind: 'rename', name: 'Existing browser bank' })
  })
  await login(page)
  await page.getByRole('button', { name: 'Import existing browser work' }).click()
  await expect(page.getByText('Signed in as')).toBeVisible()
  await page.goto('/question-banks')
  await expect(page.getByText('Existing browser bank', { exact: true }).first()).toBeVisible()
  const original = await page.evaluate(async () => {
    const { captureAccount } = await import(/* @vite-ignore */ '/src/account-backup.ts')
    const snapshot = await captureAccount(new Date(), 'test-parrot-exams-v1')
    return JSON.stringify(snapshot.manifest)
  })
  expect(original).toContain('Existing browser bank')
})


test('storage badge explains a failed cloud check', async ({ page }) => {
  await mockAuth(page)
  await login(page)
  await expect(page.getByRole('button', { name: 'Where your work is stored: Changes not synced', exact: true })).toBeVisible()
  await page.route('**/rest/v1/account_heads*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Cloud service unavailable' }) }))
  await page.getByRole('button', { name: /^Where your work is stored:/ }).click()
  await expect(page.getByRole('button', { name: 'Where your work is stored: Cloud sync unavailable', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('region', { name: 'Where your work is stored' })).toContainText('Your work remains on this device.')
})

test('the public greeting page opens a responsive login page', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/welcome')
  await expect(page.getByRole('heading', { name: 'Turn anything into an exam.' })).toBeVisible()
  await page.getByRole('link', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/test-parrot-login-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/test-parrot-login-mobile.png', fullPage: true })
  await page.getByRole('link', { name: 'Back to Test Parrot' }).click()
  await expect(page.getByRole('heading', { name: 'Turn anything into an exam.' })).toBeVisible()
})
