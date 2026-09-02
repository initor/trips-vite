import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// The hub is the only thing Vite builds. Trip pages are sealed, self-contained
// files under public/<slug>/index.html and are copied verbatim.
export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
})
