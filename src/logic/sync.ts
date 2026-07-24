/*
 * Lógica pura de la sincronización: mapeo entre el modelo local (camelCase,
 * opcionales con `?:`) y las filas remotas de Postgres (snake_case, `null`),
 * resolución de conflictos por última escritura y cursor keyset de bajada.
 * Solo funciones puras: sin React, sin Dexie, sin supabase-js, sin I/O.
 *
 * Convención de frontera (types.ts): al subir, `undefined → null`; al bajar,
 * `null → campo omitido`. `order` viaja como `sort_order` (palabra reservada).
 */
import type {
  DayEntry,
  EpochMs,
  FrozenRange,
  Habit,
  IsoDate,
  PlannerTask,
  Settings,
  SyncTable,
  TaskTemplate,
} from '../data/types'

/* ── Filas remotas (lo que se SUBE; el servidor añade user_id y synced_at) ── */

export interface RemoteHabitRow {
  id: string
  name: string
  type: Habit['type']
  target_minutes: number | null
  weekly_target: number
  sort_order: number
  created_on: IsoDate
  archived_at: EpochMs | null
  updated_at: EpochMs
  deleted_at: EpochMs | null
}

export interface RemoteEntryRow {
  id: string
  habit_id: string
  date: IsoDate
  done: boolean
  minutes: number | null
  note: string | null
  updated_at: EpochMs
  deleted_at: EpochMs | null
}

export interface RemoteFrozenRangeRow {
  id: string
  start_date: IsoDate
  end_date: IsoDate
  note: string | null
  updated_at: EpochMs
  deleted_at: EpochMs | null
}

export interface RemotePlannerTaskRow {
  id: string
  text: string
  estimated_minutes: number | null
  week_id: string
  day: number | null
  start_block: number | null
  done: boolean
  template_id: string | null
  carried_over_count: number
  updated_at: EpochMs
  deleted_at: EpochMs | null
}

export interface RemoteTaskTemplateRow {
  id: string
  text: string
  weekday: number
  start_block: number | null
  estimated_minutes: number | null
  updated_at: EpochMs
  deleted_at: EpochMs | null
}

export interface RemoteSettingsRow {
  id: 'settings'
  global_threshold: number
  notification_time: string | null
  last_export_at: EpochMs | null
  updated_at: EpochMs
  deleted_at: EpochMs | null
}

/** Fila local y remota de cada tabla, para escribir el motor sin `any`. */
export interface LocalRowByTable {
  habits: Habit
  entries: DayEntry
  frozenRanges: FrozenRange
  plannerTasks: PlannerTask
  taskTemplates: TaskTemplate
  settings: Settings
}

export interface RemoteRowByTable {
  habits: RemoteHabitRow
  entries: RemoteEntryRow
  frozenRanges: RemoteFrozenRangeRow
  plannerTasks: RemotePlannerTaskRow
  taskTemplates: RemoteTaskTemplateRow
  settings: RemoteSettingsRow
}

/** Campos que el servidor añade a toda fila bajada. */
export interface RemoteMeta {
  synced_at: string
}

/** El `& { id: string }` hace visible el id a través del genérico (todas lo tienen). */
export type PulledRow<T extends SyncTable> = RemoteRowByTable[T] & RemoteMeta & { id: string }

/* ── Nombres remotos ───────────────────────────────────────────────────────── */

const REMOTE_TABLE_NAMES: Record<SyncTable, string> = {
  habits: 'habits',
  entries: 'entries',
  frozenRanges: 'frozen_ranges',
  plannerTasks: 'planner_tasks',
  taskTemplates: 'task_templates',
  settings: 'settings',
}

export function remoteTableName(table: SyncTable): string {
  return REMOTE_TABLE_NAMES[table]
}

/* ── Mapeadores por tabla ──────────────────────────────────────────────────── */

export interface TableCodec<T extends SyncTable> {
  /** Una fila viva local siempre sube con `deleted_at: null`. */
  toRemote(local: LocalRowByTable[T]): RemoteRowByTable[T]
  fromRemote(row: RemoteRowByTable[T]): LocalRowByTable[T]
}

const habitsCodec: TableCodec<'habits'> = {
  toRemote(habit) {
    return {
      id: habit.id,
      name: habit.name,
      type: habit.type,
      target_minutes: habit.targetMinutes ?? null,
      weekly_target: habit.weeklyTarget,
      sort_order: habit.order,
      created_on: habit.createdOn,
      archived_at: habit.archivedAt,
      updated_at: habit.updatedAt,
      deleted_at: null,
    }
  },
  fromRemote(row) {
    const habit: Habit = {
      id: row.id,
      name: row.name,
      type: row.type,
      weeklyTarget: row.weekly_target,
      order: row.sort_order,
      createdOn: row.created_on,
      archivedAt: row.archived_at,
      updatedAt: row.updated_at,
    }
    if (row.target_minutes !== null) habit.targetMinutes = row.target_minutes
    return habit
  },
}

const entriesCodec: TableCodec<'entries'> = {
  toRemote(entry) {
    return {
      id: entry.id,
      habit_id: entry.habitId,
      date: entry.date,
      done: entry.done,
      minutes: entry.minutes ?? null,
      note: entry.note ?? null,
      updated_at: entry.updatedAt,
      deleted_at: null,
    }
  },
  fromRemote(row) {
    const entry: DayEntry = {
      id: row.id,
      habitId: row.habit_id,
      date: row.date,
      done: row.done,
      updatedAt: row.updated_at,
    }
    if (row.minutes !== null) entry.minutes = row.minutes
    if (row.note !== null) entry.note = row.note
    return entry
  },
}

const frozenRangesCodec: TableCodec<'frozenRanges'> = {
  toRemote(range) {
    return {
      id: range.id,
      start_date: range.startDate,
      end_date: range.endDate,
      note: range.note ?? null,
      updated_at: range.updatedAt,
      deleted_at: null,
    }
  },
  fromRemote(row) {
    const range: FrozenRange = {
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      updatedAt: row.updated_at,
    }
    if (row.note !== null) range.note = row.note
    return range
  },
}

const plannerTasksCodec: TableCodec<'plannerTasks'> = {
  toRemote(task) {
    return {
      id: task.id,
      text: task.text,
      estimated_minutes: task.estimatedMinutes ?? null,
      week_id: task.weekId,
      day: task.day,
      start_block: task.startBlock,
      done: task.done,
      template_id: task.templateId,
      carried_over_count: task.carriedOverCount,
      updated_at: task.updatedAt,
      deleted_at: null,
    }
  },
  fromRemote(row) {
    const task: PlannerTask = {
      id: row.id,
      text: row.text,
      weekId: row.week_id,
      day: row.day as PlannerTask['day'],
      startBlock: row.start_block,
      done: row.done,
      templateId: row.template_id,
      carriedOverCount: row.carried_over_count,
      updatedAt: row.updated_at,
    }
    if (row.estimated_minutes !== null) task.estimatedMinutes = row.estimated_minutes
    return task
  },
}

const taskTemplatesCodec: TableCodec<'taskTemplates'> = {
  toRemote(template) {
    return {
      id: template.id,
      text: template.text,
      weekday: template.weekday,
      start_block: template.startBlock,
      estimated_minutes: template.estimatedMinutes ?? null,
      updated_at: template.updatedAt,
      deleted_at: null,
    }
  },
  fromRemote(row) {
    const template: TaskTemplate = {
      id: row.id,
      text: row.text,
      weekday: row.weekday as TaskTemplate['weekday'],
      startBlock: row.start_block,
      updatedAt: row.updated_at,
    }
    if (row.estimated_minutes !== null) template.estimatedMinutes = row.estimated_minutes
    return template
  },
}

const settingsCodec: TableCodec<'settings'> = {
  toRemote(settings) {
    return {
      id: settings.id,
      global_threshold: settings.globalThreshold,
      notification_time: settings.notificationTime,
      last_export_at: settings.lastExportAt,
      updated_at: settings.updatedAt,
      deleted_at: null,
    }
  },
  fromRemote(row) {
    return {
      id: row.id,
      globalThreshold: row.global_threshold,
      notificationTime: row.notification_time,
      lastExportAt: row.last_export_at,
      updatedAt: row.updated_at,
    }
  },
}

export const CODECS: { [T in SyncTable]: TableCodec<T> } = {
  habits: habitsCodec,
  entries: entriesCodec,
  frozenRanges: frozenRangesCodec,
  plannerTasks: plannerTasksCodec,
  taskTemplates: taskTemplatesCodec,
  settings: settingsCodec,
}

/* ── Resolución de conflictos (última escritura gana) ─────────────────────── */

/**
 * 'remote' si la fila remota es igual de nueva o más (en empate manda el
 * servidor; el eco idéntico del propio push se corta después con `sameRow`).
 */
export function resolveLww(
  localUpdatedAt: EpochMs | null,
  remoteUpdatedAt: EpochMs,
): 'remote' | 'local' {
  if (localUpdatedAt === null) return 'remote'
  return remoteUpdatedAt >= localUpdatedAt ? 'remote' : 'local'
}

/**
 * Igualdad estructural de valores planos de fila (primitivos, sin funciones ni
 * Date). Evita escrituras — y re-renders de useLiveQuery — cuando la bajada
 * trae exactamente lo que ya hay (el eco del propio push).
 */
export function sameRow(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const keysA = Object.keys(a).filter((key) => (a as Record<string, unknown>)[key] !== undefined)
  const keysB = Object.keys(b).filter((key) => (b as Record<string, unknown>)[key] !== undefined)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) =>
    sameRow((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}

/* ── Cursor keyset de bajada ──────────────────────────────────────────────── */

/**
 * Última fila remota aplicada, en el orden (synced_at, id). Un batch de push
 * comparte `synced_at` (timestamp de transacción de Postgres): el `id` desempata
 * para que la paginación no se salte media página.
 */
export interface PullCursor {
  syncedAt: string
  rowId: string
}

/** Cursor tras aplicar una página (las filas llegan ordenadas); null si vino vacía. */
export function nextCursor(
  rows: ReadonlyArray<{ synced_at: string; id: string }>,
): PullCursor | null {
  const last = rows[rows.length - 1]
  return last === undefined ? null : { syncedAt: last.synced_at, rowId: last.id }
}

/**
 * true si la fila viene DESPUÉS del cursor en el orden (synced_at, id).
 * Los timestamps ISO de Postgres (UTC, misma anchura) ordenan lexicográficamente.
 */
export function isAfterCursor(
  row: { synced_at: string; id: string },
  cursor: PullCursor | null,
): boolean {
  if (cursor === null) return true
  if (row.synced_at > cursor.syncedAt) return true
  return row.synced_at === cursor.syncedAt && row.id > cursor.rowId
}

/* ── Utilidades ───────────────────────────────────────────────────────────── */

/** Trocea en lotes de tamaño fijo (el push sube de 500 en 500). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}
