import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Hoot',
        short_name: 'Hoot',
        description: 'Daily study plan from your exams, sources and questions.',
        lang: 'bs',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ECE9F4',
        theme_color: '#ECE9F4',
        // Android "Podijeli" → Hoot: a PDF or image from Viber, WhatsApp, Moodle or Gmail opens
        // "Daj dokument" with it (public/share-sw.js). iOS does not support share targets.
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'file', accept: ['image/*', 'application/pdf'] }],
          },
        },
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        // pdf.js is loaded only when a PDF goes to the owl, which needs a connection anyway.
        globIgnores: ['**/assets/pdf-*.js'],
        // Share target (POST /share-target) and Web Push handlers (push, notificationclick).
        importScripts: ['share-sw.js', 'push-sw.js'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    },
  },
})
