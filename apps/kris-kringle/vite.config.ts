import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [vue(), VitePWA({ registerType: 'autoUpdate', manifest: {
    name: 'Paleta Kris Kringle', short_name: 'Paleta', description: 'A double-blind family Kris Kringle',
    theme_color: '#FFF6E8', background_color: '#FFF6E8', display: 'standalone',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  } })],
})
