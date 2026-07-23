import { useLiveQuery } from 'dexie-react-hooks'
import { listFrozenRanges } from '../data/repositories/frozenRepo'
import type { FrozenRange } from '../data/types'

/** Rangos de días congelados, los más recientes arriba; undefined mientras carga. */
export function useFrozenRanges(): FrozenRange[] | undefined {
  return useLiveQuery(listFrozenRanges, [])
}
