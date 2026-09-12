import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Sistema CLER',
        short_name: 'CLER',
        description: 'Sistema Operativo Grupo CLER — entregas, tarimas y etiquetado',
        theme_color: '#03070d',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cachea los archivos estaticos de la app (JS/CSS/iconos) para que
        // cargue rapido; los datos reales (entregas, Odoo, etc.) siempre
        // se piden en vivo al backend, nunca se guardan en cache.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  server: { port: 5173 },
  preview: {
    host: '0.0.0.0',
    // Railway sirve el sitio desde este dominio (fuera de localhost) —
    // sin esto, Vite bloquea la peticion por seguridad (proteccion contra
    // DNS rebinding). El ".up.railway.app" con punto al inicio cubre
    // tambien si el subdominio cambia en el futuro.
    allowedHosts: ['cler-frontend-production.up.railway.app', '.up.railway.app']
  }
})
