import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { DailyLog } from './pages/DailyLog'
import { Habits } from './pages/Habits'
import { Planner } from './pages/Planner'
import { Settings } from './pages/Settings'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { PageTitle } from './components/ui/PageTitle'
import { SkeletonRows } from './components/ui/Skeleton'

/*
 * Las rutas están en español: la URL también es interfaz de usuario.
 * Estadísticas carga en diferido: Recharts no debe pesar en el arranque
 * del registro diario, que es lo que se abre cada noche.
 */
const Stats = lazy(() => import('./pages/Stats').then((module) => ({ default: module.Stats })))

/**
 * Lo que se ve mientras baja el chunk de Recharts (316 KB). Antes era `null`,
 * o sea el `<main>` entero vacío con la pestaña ya marcada en lima.
 *
 * Lleva el mismo envoltorio y el mismo título que la pantalla real, así que al
 * aterrizar el chunk no salta nada de sitio.
 */
function StatsFallback() {
  return (
    <div className="mx-auto max-w-xl px-5 py-6 md:px-10 md:py-10">
      <PageTitle>Rachas y estadísticas</PageTitle>
      <SkeletonRows className="mt-6" />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DailyLog />} />
      <Route path="/habitos" element={<Habits />} />
      <Route
        path="/estadisticas"
        element={
          /*
           * Límite propio, porque este es el único punto de la app donde puede
           * fallar una DESCARGA y no un cálculo: si el chunk no llega, `lazy`
           * rechaza y el error sube por el render. Con la PWA instalada el
           * chunk está precacheado y esto casi nunca se ve, pero «casi» no es
           * «nunca»: queda la primera visita sin red.
           */
          <ErrorBoundary
            title="No se ha podido cargar esta pantalla"
            detail="Suele ser un problema de red al descargar las gráficas. El resto de la app funciona con normalidad."
          >
            <Suspense fallback={<StatsFallback />}>
              <Stats />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route path="/planificador" element={<Planner />} />
      <Route path="/ajustes" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
