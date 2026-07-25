/*
 * Acceso a datos de las plantillas de tarea fija (CLAUDE.md §4).
 * El catálogo es independiente de lo que ocurre en una semana concreta: editar
 * o borrar una plantilla NO toca las tareas que ya generó.
 */
import { db } from '../db'
import { enqueueDelete, enqueueUpsert } from '../outbox'
import {
  MAX_ESTIMATED_MINUTES,
  isValidBlock,
  isValidEstimatedMinutes,
} from '../../logic/planner'
import type { IsoWeekday, TaskTemplate } from '../types'

export interface CreateTaskTemplateInput {
  text: string
  weekday: IsoWeekday
  startBlock: number | null
  estimatedMinutes?: number
}

/** `estimatedMinutes: null` quita la duración; `undefined` la deja como está. */
export interface UpdateTaskTemplatePatch {
  text?: string
  weekday?: IsoWeekday
  startBlock?: number | null
  estimatedMinutes?: number | null
}

/**
 * Todas las plantillas, por día de la semana y hora.
 * El índice de Dexie solo cubre `weekday`; el resto del orden se hace en
 * memoria porque el catálogo nunca pasa de unas pocas docenas de filas.
 */
export async function listTaskTemplates(): Promise<TaskTemplate[]> {
  const all = await db.taskTemplates.toArray()
  return all.sort(
    (a, b) =>
      a.weekday - b.weekday ||
      (a.startBlock ?? Number.MAX_SAFE_INTEGER) - (b.startBlock ?? Number.MAX_SAFE_INTEGER) ||
      a.text.localeCompare(b.text, 'es'),
  )
}

// `async` a propósito: un valor inválido llega como promesa rechazada y no como
// excepción síncrona que un llamador con `void ...` no podría capturar.
export async function createTaskTemplate(
  input: CreateTaskTemplateInput,
): Promise<TaskTemplate> {
  const text = input.text.trim()
  if (text === '') throw new Error('La plantilla necesita un texto')
  assertBlock(input.startBlock)
  assertMinutes(input.estimatedMinutes)
  return await db.transaction('rw', db.taskTemplates, db.outbox, async () => {
    const row: TaskTemplate = {
      id: crypto.randomUUID(),
      text,
      weekday: input.weekday,
      startBlock: input.startBlock,
      updatedAt: Date.now(),
    }
    if (input.estimatedMinutes !== undefined) row.estimatedMinutes = input.estimatedMinutes
    await db.taskTemplates.add(row)
    await enqueueUpsert('taskTemplates', row.id)
    return row
  })
}

/**
 * Se compone la fila entera y se hace `put` en vez de `update` parcial: hay que
 * poder ELIMINAR la duración, y confiar en cómo Dexie trata `undefined` en un
 * parche es frágil.
 */
export async function updateTaskTemplate(
  id: string,
  patch: UpdateTaskTemplatePatch,
): Promise<void> {
  if (patch.startBlock !== undefined) assertBlock(patch.startBlock)
  if (patch.estimatedMinutes !== null && patch.estimatedMinutes !== undefined) {
    assertMinutes(patch.estimatedMinutes)
  }
  await db.transaction('rw', db.taskTemplates, db.outbox, async () => {
    const current = await db.taskTemplates.get(id)
    if (current === undefined) return
    const next: TaskTemplate = {
      id: current.id,
      text: patch.text === undefined ? current.text : patch.text.trim(),
      weekday: patch.weekday ?? current.weekday,
      startBlock: patch.startBlock === undefined ? current.startBlock : patch.startBlock,
      updatedAt: Date.now(),
    }
    const minutes = patch.estimatedMinutes === undefined ? current.estimatedMinutes : patch.estimatedMinutes
    if (minutes !== undefined && minutes !== null) next.estimatedMinutes = minutes
    if (next.text === '') throw new Error('La plantilla necesita un texto')
    await db.taskTemplates.put(next)
    await enqueueUpsert('taskTemplates', id)
  })
}

/** Borra solo el catálogo: las tareas ya generadas en semanas concretas se quedan (§4). */
export async function deleteTaskTemplate(id: string): Promise<void> {
  await db.transaction('rw', db.taskTemplates, db.outbox, async () => {
    await db.taskTemplates.delete(id)
    await enqueueDelete('taskTemplates', id, Date.now())
  })
}

function assertBlock(block: number | null): void {
  if (block !== null && !isValidBlock(block)) {
    throw new Error(`Bloque horario inválido: ${block}`)
  }
}

/** La columna remota es `integer`: un número disparatado atascaría la subida. */
function assertMinutes(minutes: number | undefined): void {
  if (minutes !== undefined && !isValidEstimatedMinutes(minutes)) {
    throw new Error(`Duración inválida: ${minutes} (máximo ${MAX_ESTIMATED_MINUTES} min)`)
  }
}
