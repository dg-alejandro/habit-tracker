/*
 * Lógica del planificador (CLAUDE.md §4). Solo funciones puras: sin React, sin
 * I/O y sin Date.now() sin inyectar.
 *
 * Modelo, en dos frases:
 * - Toda tarea nace dentro de un DÍA. La hora es opcional y se pone después.
 * - Hay dos clases: las FIJAS, que salen de una ficha con varios días y su hora
 *   propia en cada uno, y las BREVES, que solo viven la semana en curso.
 *
 * Los ids que se generan aquí son función DETERMINISTA de sus argumentos: eso
 * es lo que las mantiene puras y, de paso, lo que hace que dos dispositivos
 * materializando la misma semana produzcan la misma fila.
 */
import type { IsoWeekday, WeekId } from './dates'
import type { PlannerTask, TaskTemplate } from '../data/types'

/* ── Bloques horarios ─────────────────────────────────────────────────────── */

/** La cuadrícula va en bloques de 30 minutos (§4). */
export const BLOCK_MINUTES = 30

/** 00:00–24:00 en bloques de 30 min. El esquema remoto exige start_block 0..47. */
export const BLOCKS_PER_DAY = 48

/** Primer bloque fuera de la franja nocturna: 12 = 06:00 (§4, plegada por defecto). */
export const NIGHT_END_BLOCK = 12

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

/** '09:00–10:30'; null si la tarea no tiene hora asignada. */
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

/* ── Tareas fijas: una ficha, varios días, una hora por día ───────────────── */

/**
 * Un día de una tarea fija. `startBlock: null` = ese día toca, pero sin hora
 * fija: los horarios varían, y obligar a poner hora sobra.
 */
export interface FixedTaskDay {
  weekday: IsoWeekday
  startBlock: number | null
  estimatedMinutes?: number
}

/** «Gimnasio»: un nombre y los días en los que toca, cada uno con su hora. */
export interface FixedTask {
  groupId: string
  text: string
  days: FixedTaskDay[]
}

/**
 * Id de la fila de plantilla de un día concreto de una tarea fija.
 *
 * El grupo va DENTRO del id porque la tabla remota no tiene columna para él y
 * añadirla exigiría que el propietario ejecutase SQL a mano. Agrupar por el
 * texto sería más simple pero se rompería al renombrar la tarea.
 */
export function fixedTaskEntryId(groupId: string, weekday: IsoWeekday): string {
  return `grp:${groupId}:${weekday}`
}

/** Grupo al que pertenece una fila de plantilla; null si no lleva grupo. */
export function parseFixedTaskGroupId(templateId: string): string | null {
  const match = /^grp:(.+):[1-7]$/.exec(templateId)
  return match === null ? null : (match[1] ?? null)
}

/**
 * Junta las filas de plantilla en fichas de tarea fija.
 * Una fila sin grupo en el id —las que creó la primera versión del
 * planificador— forma su propia ficha de un solo día, así que nada se pierde.
 * Salida ordenada por nombre, y los días de cada ficha, de lunes a domingo.
 */
export function groupFixedTasks(templates: readonly TaskTemplate[]): FixedTask[] {
  const byGroup = new Map<string, FixedTask>()
  for (const template of templates) {
    const groupId = parseFixedTaskGroupId(template.id) ?? template.id
    const day: FixedTaskDay = { weekday: template.weekday, startBlock: template.startBlock }
    if (template.estimatedMinutes !== undefined) day.estimatedMinutes = template.estimatedMinutes
    const existing = byGroup.get(groupId)
    if (existing === undefined) byGroup.set(groupId, { groupId, text: template.text, days: [day] })
    else existing.days.push(day)
  }
  const fixed = [...byGroup.values()]
  for (const task of fixed) task.days.sort((a, b) => a.weekday - b.weekday)
  return fixed.sort(
    (a, b) => a.text.localeCompare(b.text, 'es') || a.groupId.localeCompare(b.groupId),
  )
}

/* ── Generación de la semana ──────────────────────────────────────────────── */

/** Fila lista para insertar salvo `updatedAt`, que estampa el repositorio. */
export type GeneratedTask = Omit<PlannerTask, 'updatedAt'>

/** Borrador SIN id: el repositorio pone `crypto.randomUUID()` y `updatedAt`. */
export type PlannerTaskDraft = Omit<PlannerTask, 'id' | 'updatedAt'>

/**
 * Id de la tarea que una plantilla genera en una semana concreta.
 * Determinista a propósito: dos dispositivos que materialicen la misma semana
 * a la vez producen la MISMA fila y la guardia LWW la colapsa, en vez de dejar
 * dos copias de cada tarea fija. El prefijo la hace incolisionable con los
 * uuid de las tareas breves.
 */
export function generatedTaskId(templateId: string, weekId: WeekId): string {
  return `tpl:${templateId}:${weekId}`
}

export interface GenerateWeekTasksInput {
  templates: readonly TaskTemplate[]
  weekId: WeekId
}

/**
 * Una tarea por día de tarea fija, en su día y su bloque. Nacen pendientes.
 * Salida en orden estable e independiente del orden de entrada.
 */
export function generateWeekTasks(input: GenerateWeekTasksInput): GeneratedTask[] {
  const tasks = input.templates.map((template) => {
    const task: GeneratedTask = {
      id: generatedTaskId(template.id, input.weekId),
      text: template.text,
      weekId: input.weekId,
      day: template.weekday,
      startBlock: template.startBlock,
      done: false,
      templateId: template.id,
      // El contador de arrastre ya no se usa: nada se arrastra entre semanas.
      // La columna sigue en el esquema remoto, que no se toca.
      carriedOverCount: 0,
    }
    // La propiedad no existe cuando la ficha no tiene duración (convención de types.ts).
    if (template.estimatedMinutes !== undefined) task.estimatedMinutes = template.estimatedMinutes
    return task
  })
  return tasks.sort(
    (a, b) =>
      (a.day ?? 0) - (b.day ?? 0) ||
      blockOrder(a.startBlock) - blockOrder(b.startBlock) ||
      a.text.localeCompare(b.text, 'es') ||
      a.id.localeCompare(b.id),
  )
}

/* ── Tareas breves: solo viven la semana en curso ─────────────────────────── */

export interface EphemeralPurgeInput {
  /** Tareas de semanas ANTERIORES a currentWeek; el repositorio ya acota. */
  staleTasks: readonly PlannerTask[]
  currentWeek: WeekId
}

/**
 * Ids de las tareas breves que se borran al cambiar de semana (decisión del
 * propietario): las que quedaron sin hacer no te siguen, desaparecen.
 *
 * NO toca lo COMPLETADO —eso es historial de lo que sí hiciste— ni las
 * generadas por una tarea fija, que se quedan en su semana como registro de
 * que ese jueves no fuiste al gimnasio.
 *
 * Idempotente por construcción: borrado el lote, no queda nada que borrar.
 */
export function planEphemeralPurge(input: EphemeralPurgeInput): string[] {
  return input.staleTasks
    .filter(
      (task) => task.weekId < input.currentWeek && !task.done && task.templateId === null,
    )
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
 * Coloca en carriles las tareas CON hora de un día. Solapar es una decisión
 * legítima del usuario, no un error: nada se rechaza ni se desplaza, se
 * reparten carriles. Los carriles se comparten dentro de cada grupo conexo de
 * solapes, para que el ancho no baile al añadir una tarea al final del grupo.
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

/** Agrupa por día las tareas de una semana. */
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

/** Las que tienen hora viven en la cuadrícula; las que no, en la lista del día. */
export function scheduledTasksByDay(
  byDay: ReadonlyMap<IsoWeekday, PlannerTask[]>,
): Map<IsoWeekday, PlannerTask[]> {
  return mapValues(byDay, (tasks) => tasks.filter((task) => task.startBlock !== null))
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
 * Orden de la lista de un día. No muta la entrada.
 * Pendientes antes que hechas (la hecha se queda visible y tachada, §4); dentro
 * de cada grupo, las fijas primero —son el esqueleto del día—, luego por hora
 * (las que no tienen, al final) y luego alfabético.
 */
export function sortTasksForDisplay(tasks: readonly PlannerTask[]): PlannerTask[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      Number(a.templateId === null) - Number(b.templateId === null) ||
      blockOrder(a.startBlock) - blockOrder(b.startBlock) ||
      a.text.localeCompare(b.text, 'es') ||
      a.id.localeCompare(b.id),
  )
}

/* ── Zonas de soltado del drag & drop ─────────────────────────────────────── */

export type DropTarget =
  | { kind: 'day'; day: IsoWeekday }
  | { kind: 'slot'; day: IsoWeekday; block: number }

/** 'day:3' · 'slot:3:20'. */
export function dropTargetId(target: DropTarget): string {
  if (target.kind === 'day') return `day:${target.day}`
  return `slot:${target.day}:${target.block}`
}

/**
 * Inversa de dropTargetId; null si el id no nombra una zona válida.
 * Puro y testeado a propósito: así el onDragEnd no acaba siendo un nido de
 * split(':') sin cubrir.
 */
export function parseDropTargetId(id: string): DropTarget | null {
  const parts = id.split(':')
  const [kind, dayText, blockText] = parts
  if (kind === 'day' && parts.length === 2 && dayText !== undefined) {
    const day = parseWeekday(dayText)
    return day === null ? null : { kind: 'day', day }
  }
  if (kind === 'slot' && parts.length === 3 && dayText !== undefined && blockText !== undefined) {
    const day = parseWeekday(dayText)
    if (day === null || !/^\d+$/.test(blockText)) return null
    const block = Number(blockText)
    return isValidBlock(block) ? { kind: 'slot', day, block } : null
  }
  return null
}

function parseWeekday(text: string): IsoWeekday | null {
  if (!/^[1-7]$/.test(text)) return null
  return Number(text) as IsoWeekday
}

/** Las tareas sin hora van al final de cualquier ordenación por bloque. */
function blockOrder(startBlock: number | null): number {
  return startBlock ?? Number.MAX_SAFE_INTEGER
}

function mapValues<K, V>(source: ReadonlyMap<K, V>, transform: (value: V) => V): Map<K, V> {
  const out = new Map<K, V>()
  for (const [key, value] of source) out.set(key, transform(value))
  return out
}
