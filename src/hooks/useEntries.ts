import { useLiveQuery } from 'dexie-react-hooks'
import { getEntriesForDate } from '../data/repositories/entriesRepo'
import type { IsoDate } from '../logic/dates'
import type { DayEntry } from '../data/types'

/** Registros del día indexados por habitId; undefined mientras carga. */
export function useEntriesForDate(date: IsoDate): ReadonlyMap<string, DayEntry> | undefined {
  return useLiveQuery(async () => {
    const entries = await getEntriesForDate(date)
    return new Map(entries.map((entry) => [entry.habitId, entry]))
  }, [date])
}
