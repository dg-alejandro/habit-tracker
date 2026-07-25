/*
 * Cola de subida (outbox). Las funciones de encolado se unen a la transacción
 * Dexie AMBIENTE: el llamador DEBE incluir `db.outbox` en su lista de tablas,
 * de modo que la fila y su entrada de cola se escriben atómicamente.
 */
import { db as defaultDb, type HabitDb } from './db'
import { SYNC_TABLES, type EpochMs, type SyncTable } from './types'

export function enqueueUpsert(table: SyncTable, rowId: string): Promise<number> {
  return defaultDb.outbox.add({ table, rowId, op: 'upsert' })
}

export function enqueueDelete(table: SyncTable, rowId: string, deletedAt: EpochMs): Promise<number> {
  return defaultDb.outbox.add({ table, rowId, op: 'delete', deletedAt })
}

/**
 * Encola como upsert todas las filas existentes de las seis tablas.
 * Lo usan el import JSON y la guardia de cambio de cuenta (la migración v2
 * hace lo propio dentro de su propio upgrade). Anidable en una transacción
 * mayor que ya incluya las tablas y el outbox. Base inyectable para los tests.
 */
export async function enqueueAllExisting(db: HabitDb = defaultDb): Promise<void> {
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.outbox], async () => {
    for (const table of SYNC_TABLES) {
      const ids = await db.table(table).toCollection().primaryKeys()
      await db.outbox.bulkAdd(ids.map((id) => ({ table, rowId: String(id), op: 'upsert' as const })))
    }
  })
}
