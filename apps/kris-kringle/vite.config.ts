import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
  if (command === 'build' && mode === 'production' && supabaseUrl &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(supabaseUrl).hostname)) {
    throw new Error('Production build points at local Supabase. Supply the hosted VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY; .env.local overrides .env.')
  }
  return {
    plugins: [vue(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['favicon.svg', 'push-events.js'], workbox: { importScripts: ['/push-events.js'] }, manifest: {
      name: 'Kris Kringle', short_name: 'Kris Kringle', description: 'A double-blind family Kris Kringle',
      theme_color: '#FFF6E8', background_color: '#FFF6E8', display: 'standalone',
      icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    } })],
  }
})
