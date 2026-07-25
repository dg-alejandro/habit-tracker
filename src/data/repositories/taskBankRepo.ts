/*
 * Banco de tareas reutilizables (CLAUDE.md §4): «gimnasio», «leer», «compra».
 * No pertenece a ninguna semana ni recuerda dónde estuvo la tarea: es un
 * catálogo del que se tira arrastrando, tantas veces como haga falta.
 *
 * Se guarda en la tabla `taskTemplates`, que ya existía y ya sincroniza. Su
 * columna `weekday` es `not null` en Postgres y aquí no significa nada: se
 * escribe 1 y no se lee nunca. Quitarla exigiría que el propietario ejecutase
 * SQL a mano, y no vale la pena.
 */
import { db } from '../db'
import { enqueueDelete, enqueueUpsert } from '../outbox'
import {
  MAX_ESTIMATED_MINUTES,
  isValidEstimatedMinutes,
  type BankTask,
} from '../../logic/planner'
import type { TaskTemplate } from '../types'

export interface BankTaskInput {
  text: string
  estimatedMinutes?: number
}

/** El banco entero, por orden alfabético. */
export async function listBankTasks(): Promise<BankTask[]> {
  const rows = await db.taskTemplates.toArray()
  return rows
    .map(toBankTask)
    .sort((a, b) => a.text.localeCompare(b.text, 'es') || a.id.localeCompare(b.id))
}

export async function createBankTask(input: BankTaskInput): Promise<BankTask> {
  const text = input.text.trim()
  if (text === '') throw new Error('La tarea del banco necesita un nombre')
  assertMinutes(input.estimatedMinutes)
  return await db.transaction('rw', db.taskTemplates, db.outbox, async () => {
    const row: TaskTemplate = {
      id: crypto.randomUUID(),
      text,
      // Columna sin significado aquí; ver la cabecera del módulo.
      weekday: 1,
      startBlock: null,
      updatedAt: Date.now(),
    }
    if (input.estimatedMinutes !== undefined) row.estimatedMinutes = input.estimatedMinutes
    await db.taskTemplates.add(row)
    await enqueueUpsert('taskTemplates', row.id)
    return toBankTask(row)
  })
}

/**
 * Se compone la fila entera y se hace `put` en vez de `update` parcial: hay que
 * poder ELIMINAR la duración, y confiar en cómo Dexie trata `undefined` en un
 * parche es frágil.
 */
export async function updateBankTask(id: string, input: BankTaskInput): Promise<void> {
  const text = input.text.trim()
  if (text === '') throw new Error('La tarea del banco necesita un nombre')
  assertMinutes(input.estimatedMinutes)
  await db.transaction('rw', db.taskTemplates, db.outbox, async () => {
    const current = await db.taskTemplates.get(id)
    if (current === undefined) return
    const next: TaskTemplate = {
      id: current.id,
      text,
      weekday: current.weekday,
      startBlock: null,
      updatedAt: Date.now(),
    }
    if (input.estimatedMinutes !== undefined) next.estimatedMinutes = input.estimatedMinutes
    await db.taskTemplates.put(next)
    await enqueueUpsert('taskTemplates', id)
  })
}

/**
 * Saca la tarea del banco. Las que ya se colocaron en semanas concretas se
 * quedan donde están: son lo que hiciste (o no) esa semana.
 */
export async function deleteBankTask(id: string): Promise<void> {
  await db.transaction('rw', db.taskTemplates, db.outbox, async () => {
    await db.taskTemplates.delete(id)
    await enqueueDelete('taskTemplates', id, Date.now())
  })
}

function toBankTask(row: TaskTemplate): BankTask {
  const bank: BankTask = { id: row.id, text: row.text }
  if (row.estimatedMinutes !== undefined) bank.estimatedMinutes = row.estimatedMinutes
  return bank
}

/** La columna remota es `integer`: un número disparatado atascaría la subida. */
function assertMinutes(minutes: number | undefined): void {
  if (minutes !== undefined && !isValidEstimatedMinutes(minutes)) {
    throw new Error(`Duración inválida: ${minutes} (máximo ${MAX_ESTIMATED_MINUTES} min)`)
  }
}
