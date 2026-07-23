import { useEffect, useState } from 'react'
import { logicalDateOf, type IsoDate } from '../logic/dates'

/**
 * Día lógico actual, reactivo: se reevalúa cada minuto y al volver a la pestaña,
 * porque el día salta a las 4:00 y la app puede llevar horas abierta.
 */
export function useLogicalToday(): IsoDate {
  const [today, setToday] = useState(() => logicalDateOf(new Date()))

  useEffect(() => {
    const refresh = () => {
      const next = logicalDateOf(new Date())
      // Solo re-renderiza si el día ha cambiado de verdad.
      setToday((prev) => (prev === next ? prev : next))
    }
    const interval = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return today
}
