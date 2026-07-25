/*
 * Acceso a datos de las tareas del planificador (CLAUDE.md §4).
 * Las decisiones viven en `logic/planner.ts` (puro); aquí solo se lee, se
 * estampa el tiempo y se escribe, siempre encolando en la misma transacción.
 */
import { db } from '../db'
import { enqueueDelete, enqueueUpsert, enqueueUpsertMany } from '../outbox'
import { addWeeksToWeekId } from '../../logic/dates'
import {
  MAX_ESTIMATED_MINUTES,
  generateWeekTasks,
  isValidBlock,
  isValidEstimatedMinutes,
  planCarryOver,
  planDuplicateWeek,
  type PlannerTaskDraft,
} from '../../logic/planner'
import type { IsoWeekday, PlannerTask, WeekId } from '../types'

export interface CreateTaskInput {
  text: string
  weekId: WeekId
  /** null (o ausente) = al inbox de la semana. */
  day?: IsoWeekday | null
  startBlock?: number | null
  estimatedMinutes?: number
}

/** `estimatedMinutes: null` quita la duración; `undefined` la deja como está. */
export interface UpdateTaskPatch {
  text?: string
  estimatedMinutes?: number | null
  /** Colocación. Ambos deben venir juntos: sin día no puede haber hora. */
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
  const day = input.day ?? null
  // Sin día no puede haber hora: una tarea del inbox no vive en la cuadrícula.
  const startBlock = day === null ? null : (input.startBlock ?? null)
  assertBlock(startBlock)
  assertMinutes(input.estimatedMinutes)
  return await db.transaction('rw', db.plannerTasks, db.outbox, async () => {
    const row: PlannerTask = {
      id: crypto.randomUUID(),
      text,
      weekId: input.weekId,
      day,
      startBlock,
      done: false,
      templateId: null,
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
 * Edita la tarea entera en UNA escritura: texto, duración y colocación. Que sea
 * una sola importa — dos transacciones sin esperar releerían la misma fila y la
 * segunda pisaría lo que escribió la primera.
 *
 * Se compone la fila completa y se hace `put`: hay que poder ELIMINAR la
 * duración, y confiar en cómo Dexie trata `undefined` en un parche es frágil.
 */
export async function updateTask(id: string, patch: UpdateTaskPatch): Promise<void> {
  if (patch.day !== undefined) assertBlock(patch.day === null ? null : (patch.startBlock ?? null))
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
      // Sin día no hay hora: una tarea del inbox no vive en la cuadrícula.
      next.startBlock = patch.day === null ? null : (patch.startBlock ?? null)
    }
    return next
  })
}

/**
 * Coloca la tarea: en un día, en un bloque horario o de vuelta al inbox.
 * Es lo que llama el drop del drag & drop y los selectores del editor.
 * Invariante: sin día no hay hora.
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
 * Copia la semana anterior sobre `targetWeek`, sin estados de completado (§4).
 * Devuelve cuántas tareas copió.
 */
export async function duplicatePreviousWeek(targetWeek: WeekId): Promise<number> {
  const previousWeek = addWeeksToWeekId(targetWeek, -1)
  return db.transaction('rw', db.plannerTasks, db.outbox, async () => {
    const sourceTasks = await db.plannerTasks.where('weekId').equals(previousWeek).toArray()
    const drafts = planDuplicateWeek({ sourceTasks, targetWeek })
    if (drafts.length === 0) return 0
    await insertDrafts(drafts)
    return drafts.length
  })
}

/**
 * Prepara la semana que se está mirando. No hay cron: esto es lo que sustituye
 * al "crear una semana nueva" de §4, y corre al abrir el planificador.
 *
 * El orden importa y no es una preferencia: si se arrastrara ANTES de generar,
 * las tareas arrastradas dejarían la semana "no vacía" y las plantillas no se
 * generarían nunca más. Todo en una transacción para que no quede a medias.
 */
export async function ensureWeekReady(weekId: WeekId, currentWeekId: WeekId): Promise<void> {
  await db.transaction('rw', db.plannerTasks, db.taskTemplates, db.outbox, async () => {
    // 1. Materialización de la semana VISITADA, si es presente o futura.
    //    Marcador derivado, sin esquema nuevo: se genera solo si no hay NADA.
    //    Coste asumido: vaciar del todo una semana hace que vuelvan sus fijas.
    if (weekId >= currentWeekId) {
      const existing = await db.plannerTasks.where('weekId').equals(weekId).count()
      if (existing === 0) {
        const templates = await db.taskTemplates.toArray()
        const generated = generateWeekTasks({ templates, weekId })
        if (generated.length > 0) {
          const now = Date.now()
          // bulkPut y no bulkAdd: los ids son deterministas, así que un doble
          // disparo (StrictMode, dos pestañas, dos dispositivos) reescribe la
          // misma fila en vez de duplicarla o reventar.
          await db.plannerTasks.bulkPut(generated.map((row) => ({ ...row, updatedAt: now })))
          await enqueueUpsertMany('plannerTasks', generated.map((row) => row.id))
        }
      }
    }

    // 2. Arrastre: SIEMPRE hacia la semana actual, se esté mirando la que se esté.
    if (weekId === currentWeekId) {
      const staleTasks = await db.plannerTasks.where('weekId').below(currentWeekId).toArray()
      const patches = planCarryOver({ staleTasks, targetWeek: currentWeekId })
      if (patches.length > 0) {
        const now = Date.now()
        const byId = new Map(staleTasks.map((row) => [row.id, row]))
        const moved = patches.flatMap((patch) => {
          const current = byId.get(patch.id)
          return current === undefined ? [] : [{ ...current, ...patch, updatedAt: now }]
        })
        await db.plannerTasks.bulkPut(moved)
        await enqueueUpsertMany('plannerTasks', moved.map((row) => row.id))
      }
    }
  })
}

/** Inserta borradores dentro de una transacción ya abierta. */
async function insertDrafts(drafts: readonly PlannerTaskDraft[]): Promise<void> {
  const now = Date.now()
  const rows = drafts.map((draft) => ({ ...draft, id: crypto.randomUUID(), updatedAt: now }))
  await db.plannerTasks.bulkAdd(rows)
  await enqueueUpsertMany('plannerTasks', rows.map((row) => row.id))
}

/** Lee, transforma y reescribe la fila entera, encolando en la misma transacción. */
async function writeTask(
  id: string,
  mutate: (current: PlannerTask) => PlannerTask,
): Promise<void> {
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
