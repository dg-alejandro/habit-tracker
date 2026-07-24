/*
 * E/S del respaldo JSON — la lógica pura (formato, validación, aviso) vive en
 * logic/backup.ts. El respaldo es el ÚNICO seguro del proyecto (CLAUDE.md §9).
 *
 * Import = restauración catastrófica: reemplaza TODO lo local, bumpea
 * updatedAt (la copia restaurada debe ganar por LWW en todas partes), re-encola
 * íntegro y resetea los cursores. Limitación consciente: una fila que exista en
 * remoto pero no en la copia no se borra — la re-fusión LWW la trae de vuelta.
 */
import { db } from './db'
import { markExportedNow } from './repositories/settingsRepo'
import { requestSyncNow } from './sync'
import { buildBackup, type BackupFile } from '../logic/backup'
import { SYNC_TABLES } from './types'

export async function exportBackup(): Promise<BackupFile> {
  // Se estampa ANTES de leer: así la propia copia lleva su lastExportAt.
  await markExportedNow()
  const [habits, entries, frozenRanges, plannerTasks, taskTemplates, settings] = await Promise.all([
    db.habits.toArray(),
    db.entries.toArray(),
    db.frozenRanges.toArray(),
    db.plannerTasks.toArray(),
    db.taskTemplates.toArray(),
    db.settings.toArray(),
  ])
  return buildBackup(
    { habits, entries, frozenRanges, plannerTasks, taskTemplates, settings },
    Date.now(),
  )
}

export async function importBackup(file: BackupFile): Promise<void> {
  const now = Date.now()
  const { data } = file
  await db.transaction(
    'rw',
    [...SYNC_TABLES.map((table) => db.table(table)), db.outbox, db.syncMeta],
    async () => {
      for (const table of SYNC_TABLES) await db.table(table).clear()
      await db.outbox.clear()

      await db.habits.bulkAdd(data.habits.map((row) => ({ ...row, updatedAt: now })))
      await db.entries.bulkAdd(data.entries.map((row) => ({ ...row, updatedAt: now })))
      await db.frozenRanges.bulkAdd(data.frozenRanges.map((row) => ({ ...row, updatedAt: now })))
      await db.plannerTasks.bulkAdd(data.plannerTasks.map((row) => ({ ...row, updatedAt: now })))
      await db.taskTemplates.bulkAdd(data.taskTemplates.map((row) => ({ ...row, updatedAt: now })))
      await db.settings.bulkAdd(data.settings.map((row) => ({ ...row, updatedAt: now })))

      // Re-encolado íntegro y cursores a cero (account y firstPull se conservan).
      for (const table of SYNC_TABLES) {
        const ids = await db.table(table).toCollection().primaryKeys()
        await db.outbox.bulkAdd(
          ids.map((id) => ({ table, rowId: String(id), op: 'upsert' as const })),
        )
      }
      const metas = await db.syncMeta.toArray()
      await db.syncMeta.bulkDelete(
        metas.filter((meta) => meta.id.startsWith('cursor:')).map((meta) => meta.id),
      )
    },
  )
  requestSyncNow()
}
