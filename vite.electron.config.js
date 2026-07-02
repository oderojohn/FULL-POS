import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * POS-only Vite build for the Electron desktop app.
 * Entry: electron-src/main.jsx
 * Output: electron-dist/  (bundled into nexapos-server.exe via build.spec)
 *
 * Dev: vite --config vite.electron.config.js  → port 5174
 * Prod: vite build --config vite.electron.config.js
 */
export default defineConfig({
  plugins: [react()],
  // Root set to electron-src so index.html lands at electron-dist/index.html
  // (not electron-dist/electron-src/index.html), matching what Django expects
  // at _MEIPASS/frontend_dist/index.html in the packaged executable.
  root: 'electron-src',
  build: {
    outDir: '../electron-dist',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
      },
    },
  },
})
