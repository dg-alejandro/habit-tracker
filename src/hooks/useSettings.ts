import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings } from '../data/repositories/settingsRepo'
import type { Settings } from '../data/types'

/** Fila única de ajustes; undefined mientras carga o si aún no existe. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), [])
}
