import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// ทุกอย่างอยู่ใต้ /chip-dept/ เท่านั้น ไม่กระทบแอปอื่นบนโดเมนเดียวกัน (trong-wela, weather, AAF)
export default defineConfig({
  base: '/chip-dept/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'โรงชิพ ลงค่าประจำวัน',
        short_name: 'โรงชิพ',
        description: 'ลงค่าประจำวันแผนกโรงชิพ คำนวณต้นทุน และรายงานสรุป',
        lang: 'th',
        theme_color: '#eef1f5',
        background_color: '#eef1f5',
        display: 'standalone',
        orientation: 'any',
        start_url: '/chip-dept/',
        scope: '/chip-dept/',
        id: '/chip-dept/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: 'chip-dept',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: '/chip-dept/index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [],
      },
    }),
  ],
})
