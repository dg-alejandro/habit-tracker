/*
 * Lógica pura del respaldo JSON: construcción del archivo, validación
 * estructural al importar y el aviso de exportación pendiente. El respaldo es
 * el ÚNICO seguro del proyecto (CLAUDE.md §9): el plan gratuito de Supabase no
 * hace copias. Sin React, sin I/O, sin Date.now() sin inyectar.
 */
import { addDaysIso, logicalDateOf, type IsoDate } from './dates'
import type {
  DayEntry,
  EpochMs,
  FrozenRange,
  Habit,
  PlannerTask,
  Settings,
  TaskTemplate,
} from '../data/types'

/** El aviso salta pasados estos días lógicos sin exportar. */
export const EXPORT_REMINDER_DAYS = 30

export interface BackupData {
  habits: Habit[]
  entries: DayEntry[]
  frozenRanges: FrozenRange[]
  plannerTasks: PlannerTask[]
  taskTemplates: TaskTemplate[]
  settings: Settings[]
}

export interface BackupFile {
  app: 'habit-tracker'
  formatVersion: 1
  exportedAt: EpochMs
  data: BackupData
}

export function buildBackup(data: BackupData, exportedAt: EpochMs): BackupFile {
  return { app: 'habit-tracker', formatVersion: 1, exportedAt, data }
}

/* ── Validación estructural del import ────────────────────────────────────── */

export type BackupValidation = { ok: true; file: BackupFile } | { ok: false; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/** `?:` = puede faltar; si está, debe cumplir el predicado. */
function optional(value: unknown, predicate: (v: unknown) => boolean): boolean {
  return value === undefined || predicate(value)
}

/** `| null` = aplica pero puede estar vacío. */
function nullable(value: unknown, predicate: (v: unknown) => boolean): boolean {
  return value === null || predicate(value)
}

const ROW_VALIDATORS: { [K in keyof BackupData]: (row: Record<string, unknown>) => boolean } = {
  habits: (r) =>
    isString(r.id) &&
    isString(r.name) &&
    (r.type === 'check' || r.type === 'counter' || r.type === 'counter_note') &&
    optional(r.targetMinutes, isNumber) &&
    isNumber(r.weeklyTarget) &&
    isNumber(r.order) &&
    isString(r.createdOn) &&
    nullable(r.archivedAt, isNumber) &&
    isNumber(r.updatedAt),
  entries: (r) =>
    isString(r.id) &&
    isString(r.habitId) &&
    isString(r.date) &&
    isBoolean(r.done) &&
    optional(r.minutes, isNumber) &&
    optional(r.note, isString) &&
    isNumber(r.updatedAt),
  frozenRanges: (r) =>
    isString(r.id) &&
    isString(r.startDate) &&
    isString(r.endDate) &&
    optional(r.note, isString) &&
    isNumber(r.updatedAt),
  plannerTasks: (r) =>
    isString(r.id) &&
    isString(r.text) &&
    optional(r.estimatedMinutes, isNumber) &&
    isString(r.weekId) &&
    nullable(r.day, isNumber) &&
    nullable(r.startBlock, isNumber) &&
    isBoolean(r.done) &&
    nullable(r.templateId, isString) &&
    isNumber(r.carriedOverCount) &&
    isNumber(r.updatedAt),
  taskTemplates: (r) =>
    isString(r.id) &&
    isString(r.text) &&
    isNumber(r.weekday) &&
    nullable(r.startBlock, isNumber) &&
    optional(r.estimatedMinutes, isNumber) &&
    isNumber(r.updatedAt),
  settings: (r) =>
    r.id === 'settings' &&
    isNumber(r.globalThreshold) &&
    nullable(r.notificationTime, isString) &&
    nullable(r.lastExportAt, isNumber) &&
    isNumber(r.updatedAt),
}

const TABLE_KEYS = Object.keys(ROW_VALIDATORS) as ReadonlyArray<keyof BackupData>

/**
 * Comprueba que `raw` (el JSON parseado de un archivo) tiene la forma exacta de
 * un respaldo. Estructural: no re-deriva `done` ni valida coherencia entre
 * tablas — el respaldo se restaura tal cual se exportó.
 */
export function validateBackup(raw: unknown): BackupValidation {
  if (!isRecord(raw)) return { ok: false, reason: 'El archivo no es un objeto JSON.' }
  if (raw.app !== 'habit-tracker') {
    return { ok: false, reason: 'El archivo no es una copia de esta aplicación.' }
  }
  if (raw.formatVersion !== 1) {
    return { ok: false, reason: `Versión de formato desconocida: ${String(raw.formatVersion)}.` }
  }
  if (!isNumber(raw.exportedAt)) {
    return { ok: false, reason: 'Falta la fecha de exportación.' }
  }
  const data = raw.data
  if (!isRecord(data)) return { ok: false, reason: 'Faltan los datos de la copia.' }

  for (const table of TABLE_KEYS) {
    const rows = data[table]
    if (!Array.isArray(rows)) {
      return { ok: false, reason: `Falta la tabla «${table}» en la copia.` }
    }
    for (const [index, row] of rows.entries()) {
      if (!isRecord(row) || !ROW_VALIDATORS[table](row)) {
        return { ok: false, reason: `Fila ${index + 1} de «${table}» malformada.` }
      }
    }
  }

  return { ok: true, file: raw as unknown as BackupFile }
}

/* ── Aviso de exportación pendiente ───────────────────────────────────────── */

/**
 * true si toca avisar: han pasado MÁS de EXPORT_REMINDER_DAYS días lógicos
 * desde la última exportación — o, si nunca se exportó, desde el hábito más
 * antiguo. Sin hábitos ni exportación no hay nada que respaldar: false.
 */
export function shouldRemindExport(
  lastExportAt: EpochMs | null,
  oldestCreatedOn: IsoDate | null,
  today: IsoDate,
): boolean {
  const since = lastExportAt !== null ? logicalDateOf(new Date(lastExportAt)) : oldestCreatedOn
  if (since === null) return false
  return today > addDaysIso(since, EXPORT_REMINDER_DAYS)
}
