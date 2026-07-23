import { useLiveQuery } from 'dexie-react-hooks'
import { listActiveHabits, listAllHabits } from '../data/repositories/habitsRepo'
import type { Habit } from '../data/types'

/** Hábitos activos por orden de lista; undefined mientras carga. */
export function useActiveHabits(): Habit[] | undefined {
  return useLiveQuery(listActiveHabits, [])
}

/** Todos los hábitos por orden, archivados incluidos; undefined mientras carga. */
export function useAllHabits(): Habit[] | undefined {
  return useLiveQuery(listAllHabits, [])
}
