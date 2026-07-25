/*
 * Acceso a datos de las tareas del planificador (CLAUDE.md §4).
 * Las decisiones viven en `logic/planner.ts` (puro); aquí solo se lee, se
 * estampa el tiempo y se escribe, siempre encolando en la misma transacción.
 */
import { db } from '../db'
import { enqueueDelete, enqueueUpsert } from '../outbox'
import {
  MAX_ESTIMATED_MINUTES,
  isValidBlock,
  isValidEstimatedMinutes,
  planEphemeralPurge,
  taskFromBank,
  type BankTask,
} from '../../logic/planner'
import type { IsoWeekday, PlannerTask, WeekId } from '../types'

export interface CreateTaskInput {
  text: string
  weekId: WeekId
  estimatedMinutes?: number
}

/** `estimatedMinutes: null` quita la duración; `undefined` la deja como está. */
export interface UpdateTaskPatch {
  text?: string
  estimatedMinutes?: number | null
  /** Colocación. `day: null` la devuelve a la caja de sin colocar. */
  day?: IsoWeekday | null
  startBlock?: number | null
}

/** Todas las tareas de una semana (índice `weekId`). */
export function listWeekTasks(weekId: WeekId): Promise<PlannerTask[]> {
  return db.plannerTasks.where('weekId').equals(weekId).toArray()
}

// `async` y no una función que devuelve la transacción: así un valor inválido
// llega como promesa rechazada y no como excepción síncrona, que un llamador
// con `void createTask(...)` no podría capturar.
export async function createTask(input: CreateTaskInput): Promise<PlannerTask> {
  const text = input.text.trim()
  if (text === '') throw new Error('La tarea necesita un texto')
  assertMinutes(input.estimatedMinutes)
  return await db.transaction('rw', db.plannerTasks, db.outbox, async () => {
    const row: PlannerTask = {
      id: crypto.randomUUID(),
      text,
      weekId: input.weekId,
      // Nace sin colocar: el día y la hora los decide el arrastre.
      day: null,
      startBlock: null,
      done: false,
      // Sin ficha del banco detrás: es una tarea puntual, de esta semana y ya.
      templateId: null,
      // Ya no se arrastra nada entre semanas; la columna sigue en el esquema
      // remoto, que no se toca, pero vale siempre cero.
      carriedOverCount: 0,
      updatedAt: Date.now(),
    }
    if (input.estimatedMinutes !== undefined) row.estimatedMinutes = input.estimatedMinutes
    await db.plannerTasks.add(row)
    await enqueueUpsert('plannerTasks', row.id)
    return row
  })
}

/**
 * Edita la tarea entera en UNA escritura: texto, duración, colocación y clase.
 * Que sea una sola importa — dos transacciones sin esperar releerían la misma
 * fila y la segunda pisaría lo que escribió la primera.
 *
 * Se compone la fila completa y se hace `put`: hay que poder ELIMINAR la
 * duración, y confiar en cómo Dexie trata `undefined` en un parche es frágil.
 */
export async function updateTask(id: string, patch: UpdateTaskPatch): Promise<void> {
  if (patch.startBlock !== undefined) assertBlock(patch.startBlock)
  if (patch.estimatedMinutes !== null) assertMinutes(patch.estimatedMinutes)
  await writeTask(id, (current) => {
    const next: PlannerTask = { ...current }
    if (patch.text !== undefined) {
      const text = patch.text.trim()
      if (text === '') throw new Error('La tarea necesita un texto')
      next.text = text
    }
    if (patch.estimatedMinutes === null) delete next.estimatedMinutes
    else if (patch.estimatedMinutes !== undefined) next.estimatedMinutes = patch.estimatedMinutes
    if (patch.day !== undefined) {
      next.day = patch.day
      // Colocar es ocupar un hueco de la cuadrícula: sin día no hay hora, y con
      // día siempre hay una, porque si no la tarea no se vería en ningún sitio.
      next.startBlock = patch.day === null ? null : (patch.startBlock ?? next.startBlock)
    } else if (patch.startBlock !== undefined) {
      next.startBlock = next.day === null ? null : patch.startBlock
    }
    return next
  })
}

/**
 * Coloca la tarea en un hueco de la cuadrícula, o la devuelve a la caja de sin
 * colocar (`day: null`). Es lo que llama el drop del drag & drop.
 */
export async function moveTask(
  id: string,
  day: IsoWeekday | null,
  startBlock: number | null,
): Promise<void> {
  const block = day === null ? null : startBlock
  assertBlock(block)
  await writeTask(id, (current) => ({ ...current, day, startBlock: block }))
}

/** Completar o descompletar. La tarea hecha se queda visible y tachada (§4). */
export async function toggleTaskDone(id: string): Promise<void> {
  await writeTask(id, (current) => ({ ...current, done: !current.done }))
}

export async function deleteTask(id: string): Promise<void> {
  await db.transaction('rw', db.plannerTasks, db.outbox, async () => {
    await db.plannerTasks.delete(id)
    await enqueueDelete('plannerTasks', id, Date.now())
  })
}

/**
 * Coloca en la semana una tarea sacada del banco. El banco no se toca: la misma
 * ficha se puede soltar tantas veces como haga falta (leer, de lunes a viernes).
 */
export async function createTaskFromBank(
  bank: BankTask,
  weekId: WeekId,
  day: IsoWeekday | null,
  startBlock: number | null,
): Promise<PlannerTask> {
  const block = day === null ? null : startBlock
  assertBlock(block)
  return await db.transaction('rw', db.plannerTasks, db.outbox, async () => {
    const row: PlannerTask = {
      ...taskFromBank(bank, weekId, day, block),
      id: crypto.randomUUID(),
      updatedAt: Date.now(),
    }
    await db.plannerTasks.add(row)
    await enqueueUpsert('plannerTasks', row.id)
    return row
  })
}

/**
 * Limpieza al abrir la semana en curso: las tareas PUNTUALES que quedaron sin
 * hacer en semanas anteriores se borran. No se recrea nada — cada semana
 * empieza vacía y se llena arrastrando del banco.
 */
export async function ensureWeekReady(weekId: WeekId, currentWeekId: WeekId): Promise<void> {
  if (weekId !== currentWeekId) return
  await db.transaction('rw', db.plannerTasks, db.outbox, async () => {
    const staleTasks = await db.plannerTasks.where('weekId').below(currentWeekId).toArray()
    const doomed = planEphemeralPurge({ staleTasks, currentWeek: currentWeekId })
    if (doomed.length === 0) return
    const now = Date.now()
    await db.plannerTasks.bulkDelete(doomed)
    for (const id of doomed) await enqueueDelete('plannerTasks', id, now)
  })
}

/** Lee, transforma y reescribe la fila entera, encolando en la misma transacción. */
async function writeTask(id: string, mutate: (current: PlannerTask) => PlannerTask): Promise<void> {
  await db.transaction('rw', db.plannerTasks, db.outbox, async () => {
    const current = await db.plannerTasks.get(id)
    if (current === undefined) return
    await db.plannerTasks.put({ ...mutate(current), updatedAt: Date.now() })
    await enqueueUpsert('plannerTasks', id)
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
