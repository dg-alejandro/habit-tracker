import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    // Zona horaria hostil: los tests de fechas deben pasar en cualquier dispositivo,
    // no solo en Europe/Madrid. (En Windows puede ser inerte; en CI/Linux aplica.)
    env: { TZ: 'America/New_York' },
  },
})
