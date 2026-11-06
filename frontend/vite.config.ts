import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

/**
 * Emit /sw.js from sw/sw.template.js with this build's id and asset list, so every deploy
 * produces a byte-different service worker (which is what triggers the update prompt).
 */
function serviceWorker(): Plugin {
  return {
    name: 'makepattern-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/') && /\.(js|css)$/.test(f))
        .sort()
        .map((f) => `/${f}`)
      const buildId = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12)
      const source = readFileSync(new URL('./sw/sw.template.js', import.meta.url), 'utf8')
        .replace('__BUILD_ID__', buildId)
        .replace('__PRECACHE_ASSETS__', JSON.stringify(assets))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  // Only scan the app's own entry for dependencies (keeps the dev server from crawling stray HTML).
  optimizeDeps: { entries: ['index.html'] },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Long-lived framework code: cached across app deploys.
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
