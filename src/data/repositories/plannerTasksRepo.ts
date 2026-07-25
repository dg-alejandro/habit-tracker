/*
 * Acceso a datos de las tareas del planificador (CLAUDE.md §4).
 * Las decisiones viven en `logic/planner.ts` (puro); aquí solo se lee, se
 * estampa el tiempo y se escribe, siempre encolando en la misma transacción.
 */
import { db } from '../db'
import { enqueueDelete, enqueueUpsert, enqueueUpsertMany } from '../outbox'
import {
  MAX_ESTIMATED_MINUTES,
  isValidBlock,
  isValidEstimatedMinutes,
  persistentMark,
  planEphemeralPurge,
  planWeekRollover,
} from '../../logic/planner'
import type { IsoWeekday, PlannerTask, WeekId } from '../types'

export interface CreateTaskInput {
  text: string
  weekId: WeekId
  /** true = vuelve sola cada semana (gimnasio, leer). */
  persistent: boolean
  estimatedMinutes?: number
}

/** `estimatedMinutes: null` quita la duración; `undefined` la deja como está. */
export interface UpdateTaskPatch {
  text?: string
  estimatedMinutes?: number | null
  /** Colocación. `day: null` la devuelve a la caja de sin colocar. */
  day?: IsoWeekday | null
  startBlock?: number | null
  /** Cambiar de idea: una puntual puede pasar a persistente y al revés. */
  persistent?: boolean
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
      templateId: input.persistent ? persistentMark(crypto.randomUUID()) : null,
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
    if (patch.persistent !== undefined) {
      const alreadyPersistent = next.templateId !== null
      if (patch.persistent && !alreadyPersistent) next.templateId = persistentMark(crypto.randomUUID())
      else if (!patch.persistent) next.templateId = null
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
 * Copia la tarea en la misma semana, sin colocar. Es lo que hace llevadero
 * poner «Leer» en cinco días: se coloca una y se duplica, en vez de teclearla
 * cinco veces. La copia de una persistente es persistente por su cuenta, así
 * que cada una vuelve a su propio hueco la semana siguiente.
 */
export async function duplicateTask(id: string): Promise<PlannerTask | undefined> {
  return await db.transaction('rw', db.plannerTasks, db.outbox, async () => {
    const source = await db.plannerTasks.get(id)
    if (source === undefined) return undefined
    const copy: PlannerTask = {
      ...source,
      id: crypto.randomUUID(),
      day: null,
      startBlock: null,
      done: false,
      templateId: source.templateId === null ? null : persistentMark(crypto.randomUUID()),
      updatedAt: Date.now(),
    }
    await db.plannerTasks.add(copy)
    await enqueueUpsert('plannerTasks', copy.id)
    return copy
  })
}

/**
 * Prepara la semana que se está mirando. No hay cron: esto es lo que sustituye
 * al «crear una semana nueva» de §4, y corre al abrir el planificador.
 *
 * Dos cosas, en una sola transacción:
 * 1. Si la semana visitada es presente o futura y está VACÍA, se recrean las
 *    tareas persistentes de la última semana que tuviera algo, en su mismo
 *    hueco. El marcador de «ya preparada» es la propia semana: no hace falta
 *    tabla nueva y, por tanto, ni una línea de SQL.
 * 2. Al abrir la semana en curso, las PUNTUALES sin hacer de semanas anteriores
 *    se borran: solo viven su semana (decisión del propietario).
 */
export async function ensureWeekReady(weekId: WeekId, currentWeekId: WeekId): Promise<void> {
  await db.transaction('rw', db.plannerTasks, db.outbox, async () => {
    if (weekId >= currentWeekId) {
      const existing = await db.plannerTasks.where('weekId').equals(weekId).count()
      if (existing === 0) {
        const sourceTasks = await lastWeekWithTasks(weekId)
        const copies = planWeekRollover({ sourceTasks, targetWeek: weekId })
        if (copies.length > 0) {
          const now = Date.now()
          // bulkPut y no bulkAdd: los ids son deterministas, así que un doble
          // disparo (StrictMode, dos pestañas, dos dispositivos) reescribe la
          // misma fila en vez de duplicarla o reventar.
          await db.plannerTasks.bulkPut(copies.map((row) => ({ ...row, updatedAt: now })))
          await enqueueUpsertMany(
            'plannerTasks',
            copies.map((row) => row.id),
          )
        }
      }
    }

    if (weekId === currentWeekId) {
      const staleTasks = await db.plannerTasks.where('weekId').below(currentWeekId).toArray()
      const doomed = planEphemeralPurge({ staleTasks, currentWeek: currentWeekId })
      if (doomed.length > 0) {
        const now = Date.now()
        await db.plannerTasks.bulkDelete(doomed)
        for (const id of doomed) await enqueueDelete('plannerTasks', id, now)
      }
    }
  })
}

/**
 * Tareas de la semana con contenido más reciente ANTERIOR a la indicada.
 * Se busca hacia atrás y no solo una semana: si el planificador lleva un mes
 * sin abrirse, las persistentes tienen que volver igual.
 */
async function lastWeekWithTasks(before: WeekId): Promise<PlannerTask[]> {
  const previous = await db.plannerTasks.where('weekId').below(before).toArray()
  if (previous.length === 0) return []
  // WeekId ordena como string, así que el máximo es la semana más reciente.
  const latest = previous.reduce((best, task) => (task.weekId > best ? task.weekId : best), '')
  return previous.filter((task) => task.weekId === latest)
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
