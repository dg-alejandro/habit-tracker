/*
 * Acceso a datos de la fila única de ajustes. La fila se crea perezosamente
 * con los valores por defecto la primera vez que algo la escribe; hasta
 * entonces mandan las constantes (decisión de la Fase 1).
 */
import { db } from '../db'
import { enqueueUpsert } from '../outbox'
import { DEFAULT_GLOBAL_THRESHOLD, type Settings } from '../types'

export function getSettings(): Promise<Settings | undefined> {
  return db.settings.get('settings')
}

/** Estampa la última exportación a JSON (el aviso de los 30 días se apaga). */
export async function markExportedNow(): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.settings, db.outbox, async () => {
    const current = await db.settings.get('settings')
    const next: Settings = {
      id: 'settings',
      globalThreshold: current?.globalThreshold ?? DEFAULT_GLOBAL_THRESHOLD,
      notificationTime: current?.notificationTime ?? null,
      lastExportAt: now,
      updatedAt: now,
    }
    await db.settings.put(next)
    await enqueueUpsert('settings', 'settings')
  })
}
