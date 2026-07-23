import { useLiveQuery } from 'dexie-react-hooks'
import { getEntriesBetween } from '../data/repositories/entriesRepo'
import { listActiveHabits } from '../data/repositories/habitsRepo'
import { listFrozenRanges } from '../data/repositories/frozenRepo'
import { isoWeekDaysOf, type IsoDate } from '../logic/dates'
import { computeWeeklyPercentage } from '../logic/stats'

/**
 * Porcentaje de cumplimiento de la semana ISO de `today`, de lunes a hoy.
 * undefined mientras carga; null si no hay celdas (p. ej. semana congelada).
 * useLiveQuery observa las tres tablas y re-emite ante cualquier cambio.
 */
export function useWeeklyPercentage(today: IsoDate): number | null | undefined {
  return useLiveQuery(async () => {
    const monday = isoWeekDaysOf(today)[0]
    if (monday === undefined) return null // inalcanzable: la semana siempre tiene 7 días
    const [habits, entries, frozenRanges] = await Promise.all([
      listActiveHabits(),
      getEntriesBetween(monday, today),
      listFrozenRanges(),
    ])
    return computeWeeklyPercentage({ habits, entries, frozenRanges, today })
  }, [today])
}
