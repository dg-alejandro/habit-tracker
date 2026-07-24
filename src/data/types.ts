/*
 * Modelo de datos compartido: hábitos, registros diarios, días congelados,
 * tareas del planificador y plantillas de tarea fija. Se define completo aquí
 * (ROADMAP.md Fase 1) aunque el planificador y los ajustes no se usen hasta después.
 *
 * Convención: un campo `?:` NO aplica a ese tipo de fila (p. ej. minutos en una
 * casilla); un campo `| null` aplica pero está vacío. La Fase 2 mapea
 * `undefined → null` en la frontera de sincronización.
 */
import type { IsoDate, WeekId } from '../logic/dates'

export type { IsoDate, WeekId }

/** Epoch en milisegundos. Toda fila lo lleva: la Fase 2 resuelve conflictos por última escritura. */
export type EpochMs = number

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Casilla sí/no, contador con objetivo en minutos, o contador con nota de texto. */
export type HabitType = 'check' | 'counter' | 'counter_note'

/** Objetivo semanal mínimo por defecto: 5 de 7 días. */
export const DEFAULT_WEEKLY_TARGET = 5

/** Umbral de la racha global por defecto: 80 % de los hábitos activos. */
export const DEFAULT_GLOBAL_THRESHOLD = 0.8

export interface Habit {
  id: string
  name: string
  /** Inmutable tras la creación: cambiarlo corrompería el significado del historial. */
  type: HabitType
  /** Solo contadores: objetivo diario en minutos. */
  targetMinutes?: number
  /** Días por semana para cumplir el objetivo semanal (1–7). */
  weeklyTarget: number
  /** Posición en la lista, empezando en 0. */
  order: number
  /** Día lógico de creación: el historial del hábito empieza aquí, sin relleno hacia atrás. */
  createdOn: IsoDate
  /** null = activo. Archivar conserva historial y estadísticas. */
  archivedAt: EpochMs | null
  updatedAt: EpochMs
}

/** Registro de un hábito en un día lógico. Única por [habitId+date]. */
export interface DayEntry {
  id: string
  habitId: string
  date: IsoDate
  /**
   * En casillas la fija el usuario; en contadores se fija sola al alcanzar el
   * objetivo EN EL MOMENTO de escribir (editar el objetivo después no reescribe
   * el historial). Un día sin fila o con done=false cuenta como no cumplido.
   */
  done: boolean
  /** Solo contadores: minutos acumulados del día (10 + 20 = 30). */
  minutes?: number
  /** Solo counter_note: el contenido del día, consultable en el historial. */
  note?: string
  updatedAt: EpochMs
}

/** Rango de días congelados, bordes inclusivos. Un día congelado ni suma ni rompe. */
export interface FrozenRange {
  id: string
  startDate: IsoDate
  endDate: IsoDate
  note?: string
  updatedAt: EpochMs
}

/** Tarea del planificador semanal (Fase 4). Independiente de los hábitos. */
export interface PlannerTask {
  id: string
  text: string
  /** Determina cuántos bloques de 30 min ocupa al colocarla. */
  estimatedMinutes?: number
  /** Semana ISO a la que pertenece, p. ej. '2026-W31'. */
  weekId: WeekId
  /** null = en el inbox semanal. */
  day: IsoWeekday | null
  /** Bloque de 30 min desde las 00:00 (0–47); null = sin hora asignada. */
  startBlock: number | null
  done: boolean
  /** Plantilla que la generó; null = tarea ocasional. */
  templateId: string | null
  /** Semanas que lleva arrastrándose; a partir de 3 se marca en rojo. */
  carriedOverCount: number
  updatedAt: EpochMs
}

/** Plantilla de tarea fija: genera su tarea al crear cada semana nueva (Fase 4). */
export interface TaskTemplate {
  id: string
  text: string
  weekday: IsoWeekday
  /** Bloque de 30 min (0–47); null = sin hora. */
  startBlock: number | null
  estimatedMinutes?: number
  updatedAt: EpochMs
}

/** Fila única de ajustes. La UI llega en fases posteriores; hasta entonces mandan las constantes. */
export interface Settings {
  id: 'settings'
  /** Umbral de la racha global, 0–1. */
  globalThreshold: number
  /** 'HH:mm' o null si no hay notificación configurada. */
  notificationTime: string | null
  /** Última exportación a JSON; el aviso salta a los 30 días. */
  lastExportAt: EpochMs | null
  updatedAt: EpochMs
}

/* ── Sincronización (Fase 2) ─────────────────────────────────────────────── */

/**
 * Tablas que sincronizan, en el ORDEN de aplicación de la bajada
 * (los hábitos aterrizan antes que sus registros).
 */
export const SYNC_TABLES = [
  'habits',
  'settings',
  'frozenRanges',
  'entries',
  'plannerTasks',
  'taskTemplates',
] as const

export type SyncTable = (typeof SYNC_TABLES)[number]

export type OutboxOp = 'upsert' | 'delete'

/**
 * Cambio local pendiente de subir. Se encola en la MISMA transacción Dexie que
 * la escritura de la fila; la subida lee la fila viva en el momento del envío.
 */
export interface OutboxEntry {
  /** Autoincremental de Dexie; ausente hasta insertarse. */
  seq?: number
  table: SyncTable
  rowId: string
  op: OutboxOp
  /** Solo op='delete': instante del borrado, conservado para reintentos tardíos. */
  deletedAt?: EpochMs
}

/** Estado persistente del motor de sincronización (tabla `syncMeta`, clave `id`). */
export type SyncMetaRow =
  /** Cursor keyset de bajada por tabla: última fila remota aplicada. */
  | { id: `cursor:${SyncTable}`; syncedAt: string; rowId: string }
  /** Usuario con el que se sincronizó por última vez (guardia de cambio de cuenta). */
  | { id: 'account'; userId: string }
  /** Marca de la primera bajada completa con sesión (habilita la siembra pospuesta). */
  | { id: 'firstPull'; at: EpochMs }
