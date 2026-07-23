import { Navigate, Route, Routes } from 'react-router'
import { DailyLog } from './pages/DailyLog'
import { Habits } from './pages/Habits'
import { Stats } from './pages/Stats'
import { Planner } from './pages/Planner'
import { Settings } from './pages/Settings'

/* Las rutas están en español: la URL también es interfaz de usuario. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DailyLog />} />
      <Route path="/habitos" element={<Habits />} />
      <Route path="/estadisticas" element={<Stats />} />
      <Route path="/planificador" element={<Planner />} />
      <Route path="/ajustes" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
