/*
 * Lógica del planificador (CLAUDE.md §4). Solo funciones puras: sin React, sin
 * I/O y sin Date.now() sin inyectar.
 *
 * El modelo, entero, en tres frases:
 * - Hay un BANCO de tareas reutilizables (gimnasio, leer). No pertenece a
 *   ninguna semana ni recuerda dónde estuvo: es un catálogo del que se tira.
 * - Cada semana se arrastra del banco a la cuadrícula tantas veces como haga
 *   falta, y se escriben además tareas PUNTUALES sueltas.
 * - Al cambiar de semana, lo puntual sin hacer desaparece. El banco se queda.
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

/**
 * true si la duración es un número de minutos utilizable.
 * Entero obligatorio: la columna remota es `integer` —un 20,5 reventaría el push
 * y atascaría la cola— y además el chip pintaría un '09:00–09:20.5'.
 */
export function isValidEstimatedMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes > 0 && minutes <= MAX_ESTIMATED_MINUTES
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
 * Minutos que dura una tarea. Sin duración estimada se le supone un bloque:
 * una tarea siempre ocupa al menos su hueco en la rejilla.
 *
 * La duración NO se redondea al bloque de 30 min. La rejilla marca a qué hora
 * EMPIEZA una tarea; cuánto dura es un número de minutos suyo, y una de 20 min
 * tiene que decir 20 y pintarse como 20 (petición del propietario).
 */
export function taskMinutes(estimatedMinutes?: number): number {
  if (estimatedMinutes === undefined || !Number.isFinite(estimatedMinutes) || estimatedMinutes <= 0) {
    return BLOCK_MINUTES
  }
  // Se redondea al minuto —no al bloque— por si una fila remota vieja o un
  // import traen un decimal: '09:20,5' no es una hora.
  return Math.max(1, Math.min(Math.round(estimatedMinutes), BLOCKS_PER_DAY * BLOCK_MINUTES))
}

/**
 * Minutos que se PINTAN, recortados a medianoche. Una tarea de 3 h a las 23:30
 * se guarda tal cual (el usuario mandó) y se dibuja recortada: moverle la hora
 * de inicio a algo que nadie pidió sería peor.
 */
export function visibleMinutes(startBlock: number, estimatedMinutes?: number): number {
  const untilMidnight = (BLOCKS_PER_DAY - startBlock) * BLOCK_MINUTES
  return Math.max(1, Math.min(taskMinutes(estimatedMinutes), untilMidnight))
}

/** 'HH:mm' de un minuto del día; '24:00' a partir de medianoche. */
function minuteLabel(minuteOfDay: number): string {
  if (minuteOfDay >= BLOCKS_PER_DAY * BLOCK_MINUTES) return '24:00'
  const hours = Math.floor(minuteOfDay / 60)
  return `${String(hours).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`
}

/**
 * '09:00–09:20'; null si la tarea no está colocada. El final es el de la
 * duración entera, no el del recorte que se pinta, salvo cuando se sale del día:
 * ahí se lee '24:00', que es hasta donde llega la cuadrícula.
 */
export function blockRangeLabel(
  startBlock: number | null,
  estimatedMinutes?: number,
): string | null {
  if (startBlock === null) return null
  const start = blockToMinutes(startBlock)
  return `${blockLabel(startBlock)}–${minuteLabel(start + taskMinutes(estimatedMinutes))}`
}

/**
 * '20m' · '1h' · '1h30'. La versión que cabe en un chip de menos de media hora,
 * donde el rango completo no entra y la duración se perdería.
 */
export function shortDurationLabel(estimatedMinutes?: number): string {
  const total = taskMinutes(estimatedMinutes)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h${minutes}`
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

/* ── Banco de tareas reutilizables ───────────────────────────────────────── */

/**
 * Una tarea del banco: un nombre y, si acaso, cuánto suele durar. Nada de día
 * ni de hora — el banco no recuerda dónde estuvo la tarea la semana pasada.
 */
export interface BankTask {
  id: string
  text: string
  estimatedMinutes?: number
}

/** Identificador de arrastre de una ficha del banco, distinto del de una tarea. */
export function bankDragId(bankId: string): string {
  return `bank:${bankId}`
}

/** Ficha del banco que se está arrastrando; null si lo arrastrado es una tarea. */
export function parseBankDragId(dragId: string): string | null {
  return dragId.startsWith('bank:') ? dragId.slice('bank:'.length) : null
}

/** true si la tarea salió del banco (y no de escribirla suelta). */
export function isFromBank(task: PlannerTask): boolean {
  return task.templateId !== null
}

/** Fila lista para insertar salvo `id` y `updatedAt`, que estampa el repositorio. */
export type PlannerTaskDraft = Omit<PlannerTask, 'id' | 'updatedAt'>

/** Tarea de la semana a partir de una ficha del banco, ya colocada en su hueco. */
export function taskFromBank(
  bank: BankTask,
  weekId: WeekId,
  day: IsoWeekday | null,
  startBlock: number | null,
): PlannerTaskDraft {
  const draft: PlannerTaskDraft = {
    text: bank.text,
    weekId,
    day,
    startBlock,
    done: false,
    templateId: bank.id,
    // Ya no se arrastra nada entre semanas; la columna sigue en el esquema
    // remoto, que no se toca, pero vale siempre cero.
    carriedOverCount: 0,
  }
  if (bank.estimatedMinutes !== undefined) draft.estimatedMinutes = bank.estimatedMinutes
  return draft
}

/* ── Tareas puntuales ─────────────────────────────────────────────────────── */

export interface EphemeralPurgeInput {
  /** Tareas de semanas ANTERIORES a currentWeek; el repositorio ya acota. */
  staleTasks: readonly PlannerTask[]
  currentWeek: WeekId
}

/**
 * Ids de las tareas que se borran al cambiar de semana: lo que quedó sin hacer
 * no te sigue, desaparece (decisión del propietario).
 *
 * NO toca lo COMPLETADO —eso es el historial de lo que sí hiciste— ni lo que
 * salió del banco y SE COLOCÓ, que se queda en su semana como registro de que
 * ese jueves no fuiste al gimnasio.
 *
 * Sí borra lo que salió del banco y se quedó SIN COLOCAR: eso no llegó a ser
 * un plan de nada, y si no se limpiara se acumularía en la caja para siempre.
 *
 * Idempotente por construcción: borrado el lote, no queda nada que borrar.
 */
export function planEphemeralPurge(input: EphemeralPurgeInput): string[] {
  return input.staleTasks
    .filter(
      (task) =>
        task.weekId < input.currentWeek &&
        !task.done &&
        (task.templateId === null || task.day === null),
    )
    .map((task) => task.id)
}

/* ── Colocación en la cuadrícula ──────────────────────────────────────────── */

export interface ScheduledPlacement {
  task: PlannerTask
  startBlock: number
  /** Minutos que se pintan, ya recortados a medianoche (>= 1). */
  minutes: number
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
      return { task, startBlock, minutes: visibleMinutes(startBlock, task.estimatedMinutes) }
    })
    .sort(
      (a, b) =>
        a.startBlock - b.startBlock || b.minutes - a.minutes || a.task.id.localeCompare(b.task.id),
    )

  const placements: ScheduledPlacement[] = []
  /** Fin (exclusivo, en minutos del día) de la última tarea de cada carril. */
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
    // Los solapes se calculan en MINUTOS, no en bloques: dos tareas de 20 min
    // seguidas a las 09:00 y 09:30 no se pisan, y hay que verlo.
    const start = blockToMinutes(item.startBlock)
    // Un hueco sin solape cierra el grupo: a partir de ahí los carriles se recuentan.
    if (start >= groupEnd) closeGroup()
    let lane = laneEnds.findIndex((end) => end <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    const end = start + item.minutes
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
 * Pendientes antes que hechas, y luego alfabético.
 */
export function sortTasksForDisplay(tasks: readonly PlannerTask[]): PlannerTask[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      a.text.localeCompare(b.text, 'es') ||
      a.id.localeCompare(b.id),
  )
}

/** Bloque de 30 min en el que cae un instante del reloj de pared de Madrid. */
export function blockOfWallClock(hour: number, minute: number): number {
  return Math.max(0, Math.min(BLOCKS_PER_DAY - 1, hour * 2 + (minute >= 30 ? 1 : 0)))
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

