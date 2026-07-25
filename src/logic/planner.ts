/*
 * Lógica del planificador (CLAUDE.md §4). Solo funciones puras: sin React, sin
 * I/O y sin Date.now() sin inyectar.
 *
 * El modelo, entero, en tres frases:
 * - Una tarea nace SIN colocar y se arrastra a una casilla de la cuadrícula.
 *   Arrastrar es lo que decide su día y su hora.
 * - Hay dos clases: PERSISTENTES (gimnasio, leer) y PUNTUALES. Se crean igual y
 *   en el mismo sitio; lo único que cambia es qué pasa el lunes siguiente.
 * - Las persistentes reaparecen solas la semana que viene, en el mismo hueco.
 *   Las puntuales no: si quedaron sin hacer, se borran.
 *
 * Los ids que se generan aquí son función DETERMINISTA de sus argumentos: eso
 * es lo que las mantiene puras y, de paso, lo que hace que dos dispositivos
 * preparando la misma semana produzcan la misma fila en vez de duplicarla.
 */
import type { IsoWeekday, WeekId } from './dates'
import type { PlannerTask } from '../data/types'

/* ── Bloques horarios ─────────────────────────────────────────────────────── */

/** La cuadrícula va en bloques de 30 minutos (§4). */
export const BLOCK_MINUTES = 30

/** 00:00–24:00 en bloques de 30 min. El esquema remoto exige start_block 0..47. */
export const BLOCKS_PER_DAY = 48

/** Primer bloque fuera de la franja nocturna: 12 = 06:00 (§4, plegada por defecto). */
export const NIGHT_END_BLOCK = 12

/** Hora a la que aterriza una tarea si se coloca sin elegir bloque: 09:00. */
export const DEFAULT_BLOCK = 18

/** true si el bloque cae dentro de la cuadrícula (0–47). */
export function isValidBlock(block: number): boolean {
  return Number.isInteger(block) && block >= 0 && block < BLOCKS_PER_DAY
}

/** Minutos desde las 00:00 en los que arranca el bloque. */
export function blockToMinutes(block: number): number {
  return block * BLOCK_MINUTES
}

/**
 * Tope de la duración estimada: un día entero.
 * No es cosmético — la columna remota es `integer`, y un número disparatado
 * tecleado en el campo se guardaría en local y luego reventaría el push contra
 * Postgres, dejando la cola de subida atascada para siempre.
 */
export const MAX_ESTIMATED_MINUTES = 24 * 60

/** true si la duración es un número de minutos utilizable. */
export function isValidEstimatedMinutes(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes > 0 && minutes <= MAX_ESTIMATED_MINUTES
}

/**
 * 'HH:mm' del inicio del bloque: 0 → '00:00', 47 → '23:30'.
 * A mano y nunca con Intl: aquí 'HH:mm' es formato de DATO, y algunos motores
 * devuelven '24:00' a medianoche (la misma trampa del hourCycle de dates.ts).
 */
export function blockLabel(block: number): string {
  const minutes = blockToMinutes(block)
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * Bloques que ocupa una tarea al colocarla. Sin duración estimada ocupa uno:
 * una tarea siempre marca al menos su hora de inicio en la rejilla.
 */
export function blockSpan(estimatedMinutes?: number): number {
  if (estimatedMinutes === undefined || !Number.isFinite(estimatedMinutes)) return 1
  const blocks = Math.ceil(estimatedMinutes / BLOCK_MINUTES)
  if (blocks < 1) return 1
  return Math.min(blocks, BLOCKS_PER_DAY)
}

/**
 * Bloques que se PINTAN, recortados a medianoche. Una tarea de 3 h a las 23:30
 * se guarda tal cual (el usuario mandó) y se dibuja recortada: moverle la hora
 * de inicio a algo que nadie pidió sería peor.
 */
export function visibleSpan(startBlock: number, estimatedMinutes?: number): number {
  return Math.max(1, Math.min(blockSpan(estimatedMinutes), BLOCKS_PER_DAY - startBlock))
}

/** '09:00–10:30'; null si la tarea no está colocada. */
export function blockRangeLabel(
  startBlock: number | null,
  estimatedMinutes?: number,
): string | null {
  if (startBlock === null) return null
  const end = startBlock + blockSpan(estimatedMinutes)
  // El bloque 48 sería '24:00': a medianoche se etiqueta como el final del día.
  const endLabel = end >= BLOCKS_PER_DAY ? '24:00' : blockLabel(end)
  return `${blockLabel(startBlock)}–${endLabel}`
}

/** '30 min' · '1 h' · '1 h 30'; null si no hay duración estimada. */
export function durationLabel(estimatedMinutes?: number): string | null {
  if (estimatedMinutes === undefined || estimatedMinutes <= 0) return null
  const hours = Math.floor(estimatedMinutes / 60)
  const minutes = estimatedMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes}`
}

/* ── Persistentes y puntuales ─────────────────────────────────────────────── */

/**
 * Marca de tarea persistente. Va dentro de `templateId` —que es `text` y
 * admite nulo, tanto en Dexie como en Postgres— porque el esquema remoto no
 * tiene columna para esto y añadirla obligaría al propietario a ejecutar SQL a
 * mano. Todas las copias semanales de una misma tarea comparten esta marca, y
 * es lo que las encadena semana a semana.
 */
const PERSIST_PREFIX = 'persist:'

/** Marca de persistencia a partir de un uuid que genera el repositorio. */
export function persistentMark(uuid: string): string {
  return `${PERSIST_PREFIX}${uuid}`
}

/** true si la tarea vuelve sola la semana que viene. */
export function isPersistent(task: PlannerTask): boolean {
  return task.templateId !== null && task.templateId.startsWith(PERSIST_PREFIX)
}

/** Fila lista para insertar salvo `updatedAt`, que estampa el repositorio. */
export type GeneratedTask = Omit<PlannerTask, 'updatedAt'>

/**
 * Id de la copia de una tarea persistente en una semana concreta.
 * Determinista a propósito: dos dispositivos que preparen la misma semana a la
 * vez producen la MISMA fila y la guardia de última escritura la colapsa, en
 * vez de dejar dos gimnasios el jueves.
 */
export function weeklyCopyId(mark: string, weekId: WeekId): string {
  return `${mark}@${weekId}`
}

export interface WeekRolloverInput {
  /** Tareas de la semana anterior más reciente que tuviera algo. */
  sourceTasks: readonly PlannerTask[]
  targetWeek: WeekId
}

/**
 * Las persistentes de la semana anterior, recreadas en la nueva: mismo texto,
 * mismo hueco, misma duración, y sin marcar. Lo puntual no viaja.
 *
 * Se copian también las que quedaron SIN colocar: siguen siendo persistentes,
 * así que reaparecen en la caja de arriba esperando un hueco.
 */
export function planWeekRollover(input: WeekRolloverInput): GeneratedTask[] {
  const copies: GeneratedTask[] = []
  for (const task of input.sourceTasks) {
    if (!isPersistent(task) || task.templateId === null) continue
    const copy: GeneratedTask = {
      id: weeklyCopyId(task.templateId, input.targetWeek),
      text: task.text,
      weekId: input.targetWeek,
      day: task.day,
      startBlock: task.startBlock,
      done: false,
      templateId: task.templateId,
      carriedOverCount: 0,
    }
    if (task.estimatedMinutes !== undefined) copy.estimatedMinutes = task.estimatedMinutes
    copies.push(copy)
  }
  return copies.sort(
    (a, b) =>
      (a.day ?? 8) - (b.day ?? 8) ||
      blockOrder(a.startBlock) - blockOrder(b.startBlock) ||
      a.text.localeCompare(b.text, 'es') ||
      a.id.localeCompare(b.id),
  )
}

export interface EphemeralPurgeInput {
  /** Tareas de semanas ANTERIORES a currentWeek; el repositorio ya acota. */
  staleTasks: readonly PlannerTask[]
  currentWeek: WeekId
}

/**
 * Ids de las tareas PUNTUALES que se borran al cambiar de semana: las que
 * quedaron sin hacer no te siguen, desaparecen (decisión del propietario).
 *
 * NO toca lo COMPLETADO —eso es el historial de lo que sí hiciste— ni las
 * persistentes, que se quedan en su semana como registro de que ese jueves no
 * fuiste al gimnasio.
 *
 * Idempotente por construcción: borrado el lote, no queda nada que borrar.
 */
export function planEphemeralPurge(input: EphemeralPurgeInput): string[] {
  return input.staleTasks
    .filter((task) => task.weekId < input.currentWeek && !task.done && task.templateId === null)
    .map((task) => task.id)
}

/* ── Colocación en la cuadrícula ──────────────────────────────────────────── */

export interface ScheduledPlacement {
  task: PlannerTask
  startBlock: number
  /** Bloques que se pintan, ya recortados a medianoche (>= 1). */
  span: number
  /** Carril 0..lanes-1 dentro de su grupo conexo de solapes. */
  lane: number
  /** Carriles del grupo: el ancho del chip es 1/lanes. */
  lanes: number
}

/**
 * Coloca en carriles las tareas de un día. Solapar es una decisión legítima del
 * usuario, no un error: nada se rechaza ni se desplaza, se reparten carriles.
 * Los carriles se comparten dentro de cada grupo conexo de solapes, para que el
 * ancho no baile al añadir una tarea al final del grupo.
 * Las completadas también se colocan: siguen visibles y tachadas (§4).
 */
export function layoutDayTasks(tasks: readonly PlannerTask[]): ScheduledPlacement[] {
  const scheduled = tasks
    .filter((task) => task.startBlock !== null && isValidBlock(task.startBlock))
    .map((task) => {
      const startBlock = task.startBlock ?? 0
      return { task, startBlock, span: visibleSpan(startBlock, task.estimatedMinutes) }
    })
    .sort(
      (a, b) => a.startBlock - b.startBlock || b.span - a.span || a.task.id.localeCompare(b.task.id),
    )

  const placements: ScheduledPlacement[] = []
  /** Fin (exclusivo) de la última tarea de cada carril del grupo en curso. */
  let laneEnds: number[] = []
  /** Índices dentro de `placements` que pertenecen al grupo conexo en curso. */
  let group: number[] = []
  let groupEnd = -1

  const closeGroup = (): void => {
    for (const index of group) {
      const placement = placements[index]
      if (placement !== undefined) placement.lanes = laneEnds.length
    }
    laneEnds = []
    group = []
  }

  for (const item of scheduled) {
    // Un hueco sin solape cierra el grupo: a partir de ahí los carriles se recuentan.
    if (item.startBlock >= groupEnd) closeGroup()
    let lane = laneEnds.findIndex((end) => end <= item.startBlock)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    const end = item.startBlock + item.span
    laneEnds[lane] = end
    groupEnd = Math.max(groupEnd, end)
    group.push(placements.length)
    placements.push({ ...item, lane, lanes: 1 })
  }
  closeGroup()

  return placements
}

/**
 * Cuántas tareas caen en la franja nocturna (antes de las 06:00).
 * No es cosmético: la franja va plegada por defecto y no puede esconder tareas
 * en silencio, así que su cabecera muestra este recuento.
 */
export function countNightTasks(tasks: readonly PlannerTask[]): number {
  return tasks.filter((task) => {
    if (task.startBlock === null || !isValidBlock(task.startBlock)) return false
    // Cuenta también la que empieza justo antes de las 06:00 y se prolonga después.
    return task.startBlock < NIGHT_END_BLOCK
  }).length
}

/* ── Presentación ─────────────────────────────────────────────────────────── */

/** Agrupa por día las tareas ya colocadas. Las de la caja de arriba salen aparte. */
export function groupTasksByDay(tasks: readonly PlannerTask[]): Map<IsoWeekday, PlannerTask[]> {
  const byDay = new Map<IsoWeekday, PlannerTask[]>()
  for (const task of tasks) {
    if (task.day === null) continue
    const list = byDay.get(task.day)
    if (list === undefined) byDay.set(task.day, [task])
    else list.push(task)
  }
  return byDay
}

/**
 * Las que aún no están colocadas, ya ordenadas. Es la caja donde se escribe:
 * se vuelcan aquí y se arrastran al hueco que toque, o se quedan esperando.
 */
export function unplacedTasks(tasks: readonly PlannerTask[]): PlannerTask[] {
  return sortTasksForDisplay(tasks.filter((task) => task.day === null))
}

/** Pendientes por día, para el indicador del selector móvil. */
export function countPendingByDay(
  byDay: ReadonlyMap<IsoWeekday, PlannerTask[]>,
): Map<IsoWeekday, number> {
  const counts = new Map<IsoWeekday, number>()
  for (const [day, tasks] of byDay) counts.set(day, tasks.filter((task) => !task.done).length)
  return counts
}

/** Colocación optimista: superpone un movimiento aún sin aterrizar en la base. */
export function applyTaskMove(
  tasks: readonly PlannerTask[],
  move: { id: string; day: IsoWeekday | null; startBlock: number | null } | null,
): PlannerTask[] {
  if (move === null) return [...tasks]
  return tasks.map((task) =>
    task.id === move.id ? { ...task, day: move.day, startBlock: move.startBlock } : task,
  )
}

/**
 * Orden de la caja de sin colocar. No muta la entrada.
 * Pendientes antes que hechas; dentro de cada grupo, las persistentes primero
 * —son el esqueleto de la semana— y luego alfabético.
 */
export function sortTasksForDisplay(tasks: readonly PlannerTask[]): PlannerTask[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      Number(!isPersistent(a)) - Number(!isPersistent(b)) ||
      a.text.localeCompare(b.text, 'es') ||
      a.id.localeCompare(b.id),
  )
}

/* ── Zonas de soltado del drag & drop ─────────────────────────────────────── */

export type DropTarget = { kind: 'unplaced' } | { kind: 'slot'; day: IsoWeekday; block: number }

/** 'unplaced' · 'slot:3:20'. */
export function dropTargetId(target: DropTarget): string {
  if (target.kind === 'unplaced') return 'unplaced'
  return `slot:${target.day}:${target.block}`
}

/** Día y hora que le tocan a una tarea soltada en esa zona. */
export function placementFor(target: DropTarget): {
  day: IsoWeekday | null
  startBlock: number | null
} {
  if (target.kind === 'unplaced') return { day: null, startBlock: null }
  return { day: target.day, startBlock: target.block }
}

/**
 * Inversa de dropTargetId; null si el id no nombra una zona válida.
 * Puro y testeado a propósito: así el onDragEnd no acaba siendo un nido de
 * split(':') sin cubrir.
 */
export function parseDropTargetId(id: string): DropTarget | null {
  if (id === 'unplaced') return { kind: 'unplaced' }
  const parts = id.split(':')
  const [kind, dayText, blockText] = parts
  if (kind === 'slot' && parts.length === 3 && dayText !== undefined && blockText !== undefined) {
    if (!/^[1-7]$/.test(dayText) || !/^\d+$/.test(blockText)) return null
    const block = Number(blockText)
    return isValidBlock(block) ? { kind: 'slot', day: Number(dayText) as IsoWeekday, block } : null
  }
  return null
}

/** Las tareas sin hora van al final de cualquier ordenación por bloque. */
function blockOrder(startBlock: number | null): number {
  return startBlock ?? Number.MAX_SAFE_INTEGER
}
