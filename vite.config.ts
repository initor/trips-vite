import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

// Vercel resolves a directory request like /napa-2026/ to /napa-2026/index.html.
// Vite's dev server does not do that for files under public/, so the request fell
// through to the SPA fallback and re-served the hub. The hub's card link is
// relative, so each click appended another /napa-2026 to the path instead of
// opening the trip. This makes dev behave the way production already does.
function serveSealedPages(): Plugin {
  return {
    name: 'serve-sealed-pages',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [path] = (req.url ?? '').split('?')
        const match = /^\/([A-Za-z0-9._-]+)\/$/.exec(path)
        if (match && existsSync(resolve(__dirname, 'public', match[1], 'index.html'))) {
          req.url = `/${match[1]}/index.html`
        }
        next()
      })
    },
  }
}

// The hub is the only thing Vite builds. Trip pages are sealed, self-contained
// files under public/<slug>/index.html and are copied verbatim.
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), serveSealedPages()],
})
