import { useEffect } from 'react'
import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes'
import { NavBar } from './components/ui/NavBar'
import { ensureSeeded } from './data/seed'

export function App() {
  // Siembra los 14 hábitos la primera vez; useLiveQuery re-emite cuando aterrizan.
  useEffect(() => {
    void ensureSeeded()
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
