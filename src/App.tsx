import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, useLocation } from 'react-router'
import { AppRoutes } from './routes'
import { NavBar } from './components/ui/NavBar'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { NoticeDock } from './components/ui/NoticeDock'
import { installWriteErrorReporter } from './hooks/useWriteErrors'
import { startSync } from './data/sync'

export function App() {
  // Arranca la sincronización (bajada inicial, subida en segundo plano) y la
  // siembra: inmediata sin Supabase, pospuesta al primer pull con sesión si lo hay.
  useEffect(() => {
    startSync()
    installWriteErrorReporter()
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-dvh md:flex">
        <NavBar />
        {/*
         * El ÚNICO dueño del área segura de la app. Antes el hueco de la barra
         * inferior eran 96 px fijos contra una barra de 56 px más el inset del
         * gesto (34 px): seis píxeles de holgura y un número escrito a ojo.
         * Ahora `pb-nav` sigue al inset real, `px-safe` arregla el apaisado
         * (donde el contenido llegaba hasta el notch) y `pt-safe` es el seguro
         * por si algún día la barra de estado pasa a translúcida. Las cinco
         * páginas no saben nada de esto y no tienen que saberlo.
         */}
        {/*
         * `min-w-0` no es decorativo: en escritorio `<main>` es un elemento
         * flex, y su `min-width: auto` por defecto le impide encoger por debajo
         * del contenido más ancho que tenga dentro. Sin esto, los 920 px que
         * mide la cuadrícula del planificador empujan a `<main>` y la PÁGINA
         * ENTERA se desplaza en horizontal, en vez de desplazarse solo la
         * cuadrícula dentro de su propio contenedor.
         */}
        <main className="min-w-0 flex-1 px-safe pb-nav pt-safe md:pb-0">
          <RoutedBoundary>
            <AppRoutes />
          </RoutedBoundary>
        </main>
        {/* Fuera del límite de error a propósito: si una pantalla revienta, el
            aviso de «hay una versión nueva» puede ser justo lo que lo arregla. */}
        <NoticeDock />
      </div>
    </BrowserRouter>
  )
}

/**
 * El límite de error, con la ruta como `key`.
 *
 * Un ErrorBoundary no se resetea solo al navegar: sin esta key, la primera
 * excepción dejaría el aviso puesto en TODAS las pantallas, y la acción «Ir a
 * Ajustes y exportar la copia» —que es la salida de emergencia real— no llevaría
 * a ninguna parte. Cambiar de pestaña lo remonta y lo limpia.
 *
 * Envuelve `<main>` y NO la navegación: si el aviso se comiera la barra, el
 * usuario se quedaría atrapado en la pantalla rota.
 */
function RoutedBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
}
