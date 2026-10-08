import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { extractPage } from './extract-page'

/**
 * Injects the Cloudflare Web Analytics beacon into the built index.html.
 *
 * The token is public (it ships to the browser), but the tag is only emitted
 * when VITE_CF_BEACON_TOKEN is set, so dev servers, e2e runs, and preview
 * deploys stay out of the production dataset.
 */
function cloudflareAnalytics(token: string | undefined): Plugin {
  return {
    name: 'cloudflare-analytics',
    apply: 'build',
    transformIndexHtml() {
      if (!token) return []
      return [
        {
          tag: 'script',
          attrs: {
            type: 'module',
            src: 'https://static.cloudflareinsights.com/beacon.min.js',
            'data-cf-beacon': JSON.stringify({ token }),
          },
          injectTo: 'body',
        },
      ]
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [tailwindcss(), react(), extractPage(), cloudflareAnalytics(env.VITE_CF_BEACON_TOKEN)],
    server: {
      host: '0.0.0.0',
      port: 8000,
      allowedHosts: ['.exe.xyz', '.edtechathon.com'],
    },
  }
})
