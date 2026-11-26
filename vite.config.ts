import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Module workers: the FSRS optimizer's WASI loader uses top-level await.
  worker: { format: 'es' },
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
        // Noćna sova (src/index.css): the splash is the ground, the bar the brand (as index.html).
        background_color: '#FBF5E6',
        theme_color: '#34527A',
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
        // pdf.js is loaded only when a PDF goes to the owl, which needs a connection anyway; the
        // FSRS optimizer worker only runs online (its wasm is not precached either).
        // Voice (Sprint 18): Whisper / Kokoro and the ONNX runtime load on the first use of voice,
        // which downloads the models anyway.
        globIgnores: [
          '**/assets/pdf-*.js',
          '**/assets/fsrs*.js',
          '**/assets/kokoro-*.js',
          '**/assets/transformers*.js',
          '**/assets/stt.worker-*.js',
          '**/assets/tts.worker-*.js',
        ],
        // Share target (POST /share-target) and Web Push handlers (push, notificationclick).
        importScripts: ['share-sw.js', 'push-sw.js'],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // The app chunk reached Workbox's 2 MiB precache limit (Sprint 17): libraries go to their
        // own chunks, still precached, so each stays under it and changes less often.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            {
              name: 'markdown',
              test: /node_modules[\\/](katex|react-markdown|remark-[^\\/]+|rehype-[^\\/]+|micromark[^\\/]*|mdast-[^\\/]+|hast-[^\\/]+|unified|unist-[^\\/]+)[\\/]/,
            },
            {
              name: 'charts',
              includeDependenciesRecursively: false,
              test: /node_modules[\\/](recharts|recharts-scale|d3-[^\\/]+|victory-vendor|@reduxjs[\\/]toolkit|react-redux|redux|redux-thunk|reselect|immer)[\\/]/,
            },
            // Dynamically imported only (a PDF given to the AI or a source): its own chunk, or the
            // catch-all below pulls it into the vendor chunk every screen loads. The name matches
            // `globIgnores` above.
            { name: 'pdf', test: /node_modules[\\/]pdfjs-dist[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    },
  },
})
