import { useLiveQuery } from 'dexie-react-hooks'
import { getEntriesBetween } from '../data/repositories/entriesRepo'
import { listAllHabits } from '../data/repositories/habitsRepo'
import { listFrozenRanges } from '../data/repositories/frozenRepo'
import { getSettings } from '../data/repositories/settingsRepo'
import type { IsoDate } from '../logic/dates'
import {
  DEFAULT_GLOBAL_THRESHOLD,
  type DayEntry,
  type FrozenRange,
  type Habit,
} from '../data/types'

export interface StatsData {
  /** Todos los hábitos, archivados incluidos (la vista por hábito los necesita). */
  habits: Habit[]
  /** Historial completo, del primer createdOn a hoy. */
  entries: DayEntry[]
  frozenRanges: FrozenRange[]
  /** Umbral de la racha global con el valor por defecto ya resuelto. */
  threshold: number
}

/**
 * Todo lo que necesita la pantalla de estadísticas, en una única liveQuery:
 * los cálculos (rachas, series, heatmaps) son funciones puras que los
 * componentes aplican con useMemo sobre este resultado.
 * undefined mientras carga.
 */
export function useStatsData(today: IsoDate): StatsData | undefined {
  return useLiveQuery(async () => {
    const [habits, frozenRanges, settings] = await Promise.all([
      listAllHabits(),
      listFrozenRanges(),
      getSettings(),
    ])
    const firstCreated = habits.map((habit) => habit.createdOn).sort()[0]
    const entries =
      firstCreated === undefined ? [] : await getEntriesBetween(firstCreated, today)
    return {
      habits,
      entries,
      frozenRanges,
      threshold: settings?.globalThreshold ?? DEFAULT_GLOBAL_THRESHOLD,
    }
  }, [today])
}
