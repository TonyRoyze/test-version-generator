const registryDatabaseName = 'test-parrot-exams-v1'
const databaseVersion = 8
const mediaStore = 'media-assets'
const shellCache = 'test-parrot-shell-v1'
const shellFiles = ['/', '/index.html', '/manifest.webmanifest', '/favicon.ico', '/icon-256.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(shellCache).then((cache) => cache.addAll(shellFiles)))
  self.skipWaiting()
})
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith('test-parrot-shell-') && name !== shellCache) await caches.delete(name)
  }
  await self.clients.claim()
})()))

function openDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, databaseVersion)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function recordFrom(databaseName, storeName, key) {
  const database = await openDatabase(databaseName)
  try {
    if (!database.objectStoreNames.contains(storeName)) return null
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly')
      const get = transaction.objectStore(storeName).get(key)
      get.onsuccess = () => resolve(get.result ?? null)
      get.onerror = () => reject(get.error)
    })
  } finally {
    database.close()
  }
}

async function assetFor(hash) {
  return recordFrom(registryDatabaseName, mediaStore, hash)
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return
  if (url.pathname.startsWith('/local-images/')) {
    const hash = url.pathname.slice('/local-images/'.length)
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      event.respondWith(new Response('Image not found', { status: 404 }))
      return
    }
    event.respondWith(assetFor(hash).then(
      (asset) => asset
        ? new Response(asset.bytes, { headers: { 'Content-Type': asset.mimeType } })
        : new Response('Image not found', { status: 404 }),
      () => new Response('Image not found', { status: 404 }),
    ))
    return
  }

  // Navigations use the network when available and fall back to the cached
  // app shell, so direct links such as /editor and /question-banks reopen offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () =>
      (await caches.match('/index.html')) || new Response('App is unavailable offline', { status: 503 }),
    ))
    return
  }

  // Cache built assets as they are first requested. Vite's hashed asset names
  // make cache-first safe across deployments; HTML and API-like requests stay
  // network-first.
  if (url.pathname.startsWith('/assets/') || /\.(?:js|css|woff2?|ttf|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(shellCache)
      const cached = await cache.match(event.request)
      if (cached) return cached
      const response = await fetch(event.request)
      if (response.ok) await cache.put(event.request, response.clone())
      return response
    })())
  }
})
