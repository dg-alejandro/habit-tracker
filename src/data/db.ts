/*
 * Esquema de IndexedDB vía Dexie. Los componentes nunca importan este módulo:
 * acceden a los datos a través de `repositories/` y de hooks (CLAUDE.md §2).
 *
 * Las seis tablas se declaran ya en version(1) —también las del planificador y
 * ajustes, que no se usan hasta las Fases 2 y 4— para no migrar el esquema después.
 */
import Dexie, { type Table } from 'dexie'
import type {
  DayEntry,
  FrozenRange,
  Habit,
  OutboxEntry,
  PlannerTask,
  Settings,
  SyncMetaRow,
  TaskTemplate,
} from './types'
import { SYNC_TABLES } from './types'

/** Exportada (con nombre inyectable) solo para los tests de sincronización y migración. */
export class HabitDb extends Dexie {
  habits!: Table<Habit, string>
  entries!: Table<DayEntry, string>
  frozenRanges!: Table<FrozenRange, string>
  plannerTasks!: Table<PlannerTask, string>
  taskTemplates!: Table<TaskTemplate, string>
  settings!: Table<Settings, string>
  outbox!: Table<OutboxEntry, number>
  syncMeta!: Table<SyncMetaRow, string>

  constructor(name = 'habit-tracker') {
    super(name)
    this.version(1).stores({
      // Sin índice sobre archivedAt: Dexie no indexa null; el filtrado de
      // activos se hace en memoria (la tabla nunca pasa de unas docenas).
      habits: 'id, order',
      // &[habitId+date] es ÚNICO: imposible duplicar el día de un hábito.
      entries: 'id, &[habitId+date], date, habitId',
      frozenRanges: 'id, startDate',
      plannerTasks: 'id, weekId',
      taskTemplates: 'id, weekday',
      settings: 'id',
    })
    // v2: cola de subida y estado del motor de sincronización. El upgrade solo
    // corre al migrar una base v1 existente: encola TODO como upsert para que
    // el historial de la Fase 1 se suba en el primer sync. Una base recién
    // creada no pasa por aquí (su semilla ya encola).
    this.version(2)
      .stores({
        outbox: '++seq',
        syncMeta: 'id',
      })
      .upgrade(async (tx) => {
        for (const table of SYNC_TABLES) {
          const ids = await tx.table(table).toCollection().primaryKeys()
          await tx
            .table<OutboxEntry, number>('outbox')
            .bulkAdd(ids.map((id) => ({ table, rowId: String(id), op: 'upsert' as const })))
        }
      })
  }
}

export const db = new HabitDb()
