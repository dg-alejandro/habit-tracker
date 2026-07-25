import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { DailyLog } from './pages/DailyLog'
import { Habits } from './pages/Habits'
import { Planner } from './pages/Planner'
import { Settings } from './pages/Settings'
import { TaskTemplates } from './pages/TaskTemplates'

/*
 * Las rutas están en español: la URL también es interfaz de usuario.
 * Estadísticas carga en diferido: Recharts no debe pesar en el arranque
 * del registro diario, que es lo que se abre cada noche.
 */
const Stats = lazy(() => import('./pages/Stats').then((module) => ({ default: module.Stats })))

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DailyLog />} />
      <Route path="/habitos" element={<Habits />} />
      <Route
        path="/estadisticas"
        element={
          <Suspense fallback={null}>
            <Stats />
          </Suspense>
        }
      />
      <Route path="/planificador" element={<Planner />} />
      {/* Subruta y no estado local: el botón atrás del iPhone tiene que servir. */}
      <Route path="/planificador/plantillas" element={<TaskTemplates />} />
      <Route path="/ajustes" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
