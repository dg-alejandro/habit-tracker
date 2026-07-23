import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes'
import { NavBar } from './components/ui/NavBar'

export function App() {
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
