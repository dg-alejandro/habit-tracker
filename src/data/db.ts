/*
 * Esquema de IndexedDB vía Dexie. Los componentes nunca importan este módulo:
 * acceden a los datos a través de `repositories/` y de hooks (CLAUDE.md §2).
 *
 * Las seis tablas se declaran ya en version(1) —también las del planificador y
 * ajustes, que no se usan hasta las Fases 2 y 4— para no migrar el esquema después.
 */
import Dexie, { type Table } from 'dexie'
import type { DayEntry, FrozenRange, Habit, PlannerTask, Settings, TaskTemplate } from './types'

class HabitDb extends Dexie {
  habits!: Table<Habit, string>
  entries!: Table<DayEntry, string>
  frozenRanges!: Table<FrozenRange, string>
  plannerTasks!: Table<PlannerTask, string>
  taskTemplates!: Table<TaskTemplate, string>
  settings!: Table<Settings, string>

  constructor() {
    super('habit-tracker')
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
  }
}

export const db = new HabitDb()
