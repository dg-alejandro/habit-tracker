import { useEffect } from 'react'
import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes'
import { NavBar } from './components/ui/NavBar'
import { startSync } from './data/sync'

export function App() {
  // Arranca la sincronización (bajada inicial, subida en segundo plano) y la
  // siembra: inmediata sin Supabase, pospuesta al primer pull con sesión si lo hay.
  useEffect(() => {
    startSync()
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-dvh md:flex">
        <NavBar />
        {/* Hueco inferior en móvil para que la barra fija no tape el contenido */}
        <main className="flex-1 pb-24 md:pb-0">
          <AppRoutes />
        </main>
      </div>
    </BrowserRouter>
  )
}
