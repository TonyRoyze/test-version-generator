import { expect, test } from 'bun:test'
import { runInNewContext } from 'node:vm'

const source = await Bun.file(new URL('../public/image-worker.js', import.meta.url)).text()

function worker() {
  const listeners = new Map<string, (event: { request: { url: string; method: string; mode: string }; respondWith: (response: unknown) => void }) => void>()
  let cacheReads = 0
  runInNewContext(source, {
    URL,
    self: { location: { origin: 'https://testparrot.example' }, addEventListener: (type: string, listener: typeof listeners extends Map<string, infer T> ? T : never) => listeners.set(type, listener) },
    caches: { open: async () => { cacheReads++; return { match: async () => ({ cached: true }) } } },
  })
  return {
    async handles(path: string) {
      let response: unknown
      listeners.get('fetch')!({ request: { url: `https://testparrot.example${path}`, method: 'GET', mode: 'cors' }, respondWith: (value) => { response = value } })
      if (response) await response
      return response !== undefined
    },
    cacheReads: () => cacheReads,
  }
}

test('development source and dependency modules bypass the offline asset cache', async () => {
  const service = worker()
  for (const path of ['/src/styles.css', '/src/main.tsx', '/node_modules/.vite/deps/react.js?v=abc', '/@vite/client']) {
    expect(await service.handles(path)).toBe(false)
  }
  expect(service.cacheReads()).toBe(0)
})

test('versioned production assets still use the offline cache', async () => {
  const service = worker()
  expect(await service.handles('/assets/index-abcd1234.css')).toBe(true)
  expect(service.cacheReads()).toBe(1)
})
