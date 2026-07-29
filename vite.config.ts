import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' y no 'autoUpdate' (decisión del propietario): la app se usa de
      // noche marcando hábitos y una recarga a media interacción es intolerable.
      // Con 'prompt' el plugin deja skipWaiting y clientsClaim en false, que es
      // justo lo que hace falta: el service worker nuevo espera a que el usuario
      // pulse «Actualizar» en el aviso de UpdatePrompt.
      registerType: 'prompt',
      // El registro lo hace useAppUpdate con useRegisterSW. Sin esto el plugin
      // inyectaría un segundo registro en index.html.
      injectRegister: null,
      // Nada de service worker en desarrollo: cachearía el módulo de Vite y
      // convertiría cada recarga en una partida de adivinanzas.
      devOptions: { enabled: false },
      manifest: {
        id: '/',
        name: 'Hábitos',
        short_name: 'Hábitos',
        description: 'Seguimiento de hábitos y planificación semanal.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 'any' y no 'portrait': iOS ignora el campo, así que esto solo afecta a
        // escritorio y Android — y ahí la cuadrícula de siete columnas y el mapa
        // del año se leen mucho mejor apaisados.
        orientation: 'any',
        background_color: '#0f0f0f',
        theme_color: '#0f0f0f',
        categories: ['productivity', 'lifestyle', 'health'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Sin esto, abrir /planificador desde el icono de la pantalla de inicio
        // sin red da un 404 del propio service worker. Es el equivalente offline
        // de la reescritura que Vercel ya hace en el servidor.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Explícito y no por defecto (2 MiB): el chunk de arranque ya pesa
        // ~690 KB. Si algún día una dependencia lo empujara por encima del
        // límite, Workbox lo excluiría del precache EN SILENCIO y la app
        // dejaría de funcionar sin red sin que nadie se entere.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    // Zona horaria hostil: los tests de fechas deben pasar en cualquier dispositivo,
    // no solo en Europe/Madrid. Vitest la inyecta en caliente dentro del worker
    // (funciona también en Windows, comprobado); si alguna versión futura la
    // dejara inerte, el canario de dates.test.ts lo convierte en fallo ruidoso.
    env: { TZ: 'America/New_York' },
  },
})

/*
 * NO AÑADIR runtimeCaching QUE ALCANCE SUPABASE. Ni ahora ni en la Fase 6.
 *
 * Con `generateSW` y sin `runtimeCaching`, el service worker generado contiene
 * exactamente dos cosas: el precache de dist/ y la ruta de navegación. Ninguna
 * intercepta las peticiones a *.supabase.co — el precache solo tiene URLs
 * propias, y la ruta de navegación solo empareja `request.mode === 'navigate'`,
 * mientras que supabase-js usa `mode: 'cors'`. Por eso la sincronización ve
 * siempre la red de verdad.
 *
 * Un NetworkFirst sobre el REST devolvería una foto vieja al motor de
 * sincronización; con resolución por última escritura, `lastPulledAt` se
 * estamparía tras esa bajada «completa», `useSyncSettled` la daría por buena y
 * la purga semanal borraría tareas que el otro dispositivo acaba de completar.
 * Es exactamente la pérdida de datos que arregló la auditoría del 28/07.
 *
 * Cuidado en particular con el patrón de tutorial
 * `({ url }) => url.origin !== self.location.origin`, que aquí es veneno.
 */
