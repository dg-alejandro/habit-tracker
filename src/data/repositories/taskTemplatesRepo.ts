/*
 * Acceso a datos de las tareas fijas (CLAUDE.md §4).
 *
 * Una tarea fija —«Gimnasio»— es UNA ficha con varios días, y cada día lleva su
 * propia hora: los horarios varían y un jueves no es un sábado. Por debajo, la
 * tabla guarda una fila por día, agrupadas por el identificador de grupo que
 * viaja dentro del `id` (`grp:<grupo>:<día>`), porque la tabla remota no tiene
 * columna de grupo y añadirla exigiría ejecutar SQL a mano.
 *
 * El catálogo es independiente de lo que ocurre en una semana concreta: editar
 * o borrar una tarea fija NO toca las tareas que ya generó.
 */
import { db } from '../db'
import { enqueueDelete, enqueueUpsert } from '../outbox'
import {
  MAX_ESTIMATED_MINUTES,
  fixedTaskEntryId,
  groupFixedTasks,
  isValidBlock,
  isValidEstimatedMinutes,
  parseFixedTaskGroupId,
  type FixedTask,
  type FixedTaskDay,
} from '../../logic/planner'
import type { TaskTemplate } from '../types'

export interface FixedTaskInput {
  text: string
  /** Al menos uno. Cada día lleva su hora, que puede ser null. */
  days: readonly FixedTaskDay[]
}

/** Todas las tareas fijas, agrupadas y por orden alfabético. */
export async function listFixedTasks(): Promise<FixedTask[]> {
  return groupFixedTasks(await db.taskTemplates.toArray())
}

export async function createFixedTask(input: FixedTaskInput): Promise<string> {
  const { text, days } = validate(input)
  const groupId = crypto.randomUUID()
  const now = Date.now()
  const rows = days.map((day) => buildRow(groupId, text, day, now))
  await db.transaction('rw', db.taskTemplates, db.outbox, async () => {
    await db.taskTemplates.bulkPut(rows)
    for (const row of rows) await enqueueUpsert('taskTemplates', row.id)
  })
  return groupId
}

/**
 * Reescribe la ficha entera: cambia el nombre, añade días, les cambia la hora y
 * borra los que ya no toquen. Las tareas ya generadas en semanas concretas se
 * quedan como están (§4).
 */
export async function updateFixedTask(groupId: string, input: FixedTaskInput): Promise<void> {
  const { text, days } = validate(input)
  const now = Date.now()
  const rows = days.map((day) => buildRow(groupId, text, day, now))
  const keep = new Set(rows.map((row) => row.id))
  await db.transaction('rw', db.taskTemplates, db.outbox, async () => {
    const existing = await rowsOfGroup(groupId)
    const removed = existing.filter((row) => !keep.has(row.id))
    await db.taskTemplates.bulkPut(rows)
    for (const row of rows) await enqueueUpsert('taskTemplates', row.id)
    if (removed.length > 0) {
      await db.taskTemplates.bulkDelete(removed.map((row) => row.id))
      for (const row of removed) await enqueueDelete('taskTemplates', row.id, now)
    }
  })
}

/** Borra la ficha y todos sus días. Las tareas ya generadas se quedan (§4). */
export async function deleteFixedTask(groupId: string): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.taskTemplates, db.outbox, async () => {
    const existing = await rowsOfGroup(groupId)
    if (existing.length === 0) return
    await db.taskTemplates.bulkDelete(existing.map((row) => row.id))
    for (const row of existing) await enqueueDelete('taskTemplates', row.id, now)
  })
}

/**
 * Filas de un grupo. Incluye las fichas antiguas de un solo día, cuyo `id` es
 * un uuid suelto y hace de grupo de sí mismo.
 */
async function rowsOfGroup(groupId: string): Promise<TaskTemplate[]> {
  const all = await db.taskTemplates.toArray()
  return all.filter((row) => (parseFixedTaskGroupId(row.id) ?? row.id) === groupId)
}

function buildRow(groupId: string, text: string, day: FixedTaskDay, now: number): TaskTemplate {
  const row: TaskTemplate = {
    id: fixedTaskEntryId(groupId, day.weekday),
    text,
    weekday: day.weekday,
    startBlock: day.startBlock,
    updatedAt: now,
  }
  if (day.estimatedMinutes !== undefined) row.estimatedMinutes = day.estimatedMinutes
  return row
}

function validate(input: FixedTaskInput): { text: string; days: FixedTaskDay[] } {
  const text = input.text.trim()
  if (text === '') throw new Error('La tarea fija necesita un nombre')
  if (input.days.length === 0) throw new Error('Elige al menos un día')
  const seen = new Set<number>()
  const days: FixedTaskDay[] = []
  for (const day of input.days) {
    // Un mismo día dos veces colisionaría en el id; gana la última entrada.
    if (seen.has(day.weekday)) continue
    seen.add(day.weekday)
    if (day.startBlock !== null && !isValidBlock(day.startBlock)) {
      throw new Error(`Bloque horario inválido: ${day.startBlock}`)
    }
    // La columna remota es `integer`: un número disparatado atascaría la subida.
    if (day.estimatedMinutes !== undefined && !isValidEstimatedMinutes(day.estimatedMinutes)) {
      throw new Error(`Duración inválida: ${day.estimatedMinutes} (máximo ${MAX_ESTIMATED_MINUTES} min)`)
    }
    days.push(day)
  }
  return { text, days }
}
