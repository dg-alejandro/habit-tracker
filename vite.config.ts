import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    // Zona horaria hostil: los tests de fechas deben pasar en cualquier dispositivo,
    // no solo en Europe/Madrid. Vitest la inyecta en caliente dentro del worker
    // (funciona también en Windows, comprobado); si alguna versión futura la
    // dejara inerte, el canario de dates.test.ts lo convierte en fallo ruidoso.
    env: { TZ: 'America/New_York' },
  },
})
