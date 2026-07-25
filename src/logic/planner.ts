/*
 * Lógica del planificador (CLAUDE.md §4): cuadrícula de bloques, generación de
 * tareas desde plantillas, arrastre de no completadas al inbox siguiente y
 * colocación en la rejilla horaria.
 * Solo funciones puras: sin React, sin I/O y sin Date.now() sin inyectar.
 *
 * Los ids que sí se generan aquí (`generatedTaskId`) son función DETERMINISTA
 * de sus argumentos: eso es lo que las mantiene puras y, de paso, lo que hace
 * que dos dispositivos materializando la misma semana produzcan la misma fila.
 */
import { weeksBetweenWeekIds, type IsoWeekday, type WeekId } from './dates'
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

/** Bloque que contiene ese minuto del día; redondea hacia abajo. */
export function minutesToBlock(minutes: number): number {
  return Math.floor(minutes / BLOCK_MINUTES)
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

/* ── Generación desde plantillas ──────────────────────────────────────────── */

/** Fila lista para insertar salvo `updatedAt`, que estampa el repositorio. */
export type GeneratedTask = Omit<PlannerTask, 'updatedAt'>

/** Borrador SIN id: el repositorio pone `crypto.randomUUID()` y `updatedAt`. */
export type PlannerTaskDraft = Omit<PlannerTask, 'id' | 'updatedAt'>

/**
 * Id de la tarea que una plantilla genera en una semana concreta.
 * Determinista a propósito: dos dispositivos que materialicen la misma semana
 * a la vez producen la MISMA fila y la guardia LWW la colapsa, en vez de dejar
 * dos copias de cada tarea fija. El prefijo la hace incolisionable con los
 * uuid de las tareas ocasionales.
 */
export function generatedTaskId(templateId: string, weekId: WeekId): string {
  return `tpl:${templateId}:${weekId}`
}

export interface GenerateWeekTasksInput {
  templates: readonly TaskTemplate[]
  weekId: WeekId
}

/**
 * Una tarea por plantilla, en su día y su bloque. Nacen pendientes y sin
 * arrastre. Salida en orden estable e independiente del orden de entrada.
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
      carriedOverCount: 0,
    }
    // La propiedad no existe cuando la plantilla no tiene duración (convención de types.ts).
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

/* ── Arrastre semanal ─────────────────────────────────────────────────────── */

export interface CarryOverPlanInput {
  /** Tareas de semanas ANTERIORES a targetWeek; el repositorio ya acota con .below(). */
  staleTasks: readonly PlannerTask[]
  targetWeek: WeekId
}

/** Parche por tarea que se mueve. El repositorio estampa `updatedAt`. */
export interface CarryOverPatch {
  id: string
  weekId: WeekId
  day: null
  startBlock: null
  carriedOverCount: number
}

/**
 * Mueve (no copia) al inbox de targetWeek toda tarea no completada y SIN
 * plantilla (§4: las generadas por plantilla no se arrastran; se quedan en su
 * semana como historial y la semana nueva genera las suyas).
 *
 * `carriedOverCount` sube las semanas REALMENTE transcurridas, no una por
 * evento: si no se abre el planificador en cinco semanas, la tarea debe llegar
 * en rojo, que es justo cuando más tiene que gritar.
 *
 * Idempotente por construcción: aplicado el parche, weekId === targetWeek y la
 * tarea deja de entrar en staleTasks.
 */
export function planCarryOver(input: CarryOverPlanInput): CarryOverPatch[] {
  const patches: CarryOverPatch[] = []
  for (const task of input.staleTasks) {
    if (task.weekId >= input.targetWeek) continue
    if (task.done) continue
    if (task.templateId !== null) continue
    const weeks = weeksBetweenWeekIds(task.weekId, input.targetWeek)
    patches.push({
      id: task.id,
      weekId: input.targetWeek,
      day: null,
      startBlock: null,
      carriedOverCount: Math.max(0, task.carriedOverCount) + Math.max(1, weeks),
    })
  }
  return patches
}

/* ── Duplicar la semana anterior ──────────────────────────────────────────── */

export interface DuplicateWeekInput {
  sourceTasks: readonly PlannerTask[]
  targetWeek: WeekId
}

/**
 * Copia las tareas de la semana origen SIN su estado de completado (§4),
 * conservando texto, día, bloque y duración. Excluye las generadas por
 * plantilla: la semana destino genera las suyas y copiarlas las duplicaría.
 * Las copias nacen ocasionales, así que sí se arrastrarán si no se hacen.
 */
export function planDuplicateWeek(input: DuplicateWeekInput): PlannerTaskDraft[] {
  const drafts: PlannerTaskDraft[] = []
  for (const task of input.sourceTasks) {
    if (task.templateId !== null) continue
    const draft: PlannerTaskDraft = {
      text: task.text,
      weekId: input.targetWeek,
      day: task.day,
      startBlock: task.startBlock,
      done: false,
      templateId: null,
      carriedOverCount: 0,
    }
    if (task.estimatedMinutes !== undefined) draft.estimatedMinutes = task.estimatedMinutes
    drafts.push(draft)
  }
  return drafts
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

/** Primer bloque ocupado del día, o null si no hay ninguna tarea con hora. */
export function firstOccupiedBlock(tasks: readonly PlannerTask[]): number | null {
  let first: number | null = null
  for (const task of tasks) {
    if (task.startBlock === null || !isValidBlock(task.startBlock)) continue
    if (first === null || task.startBlock < first) first = task.startBlock
  }
  return first
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

/** true si hay alguna tarea en la franja nocturna. */
export function hasNightTasks(tasks: readonly PlannerTask[]): boolean {
  return countNightTasks(tasks) > 0
}

/* ── Presentación ─────────────────────────────────────────────────────────── */

/**
 * Orden del inbox y de las listas sin hora. No muta la entrada.
 * Pendientes antes que hechas (la hecha se queda visible y tachada, §4);
 * dentro de cada grupo, primero las más arrastradas —las rojas arriba,
 * gritando—, luego por bloque (las sin hora al final) y luego alfabético.
 */
export function sortTasksForDisplay(tasks: readonly PlannerTask[]): PlannerTask[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      b.carriedOverCount - a.carriedOverCount ||
      blockOrder(a.startBlock) - blockOrder(b.startBlock) ||
      a.text.localeCompare(b.text, 'es') ||
      a.id.localeCompare(b.id),
  )
}

export type CarryLevel = 'none' | 'warn' | 'alarm'

/**
 * Nivel de alarma por arrastre. A partir de la TERCERA semana arrastrada la
 * tarea se marca en rojo (§4): o se hace, o se borra. Antes, aviso monocromo.
 */
export function carryLevel(carriedOverCount: number): CarryLevel {
  if (carriedOverCount >= 3) return 'alarm'
  if (carriedOverCount >= 1) return 'warn'
  return 'none'
}

/** '2ª semana' · '3ª semana'…; null si la tarea nunca se arrastró. */
export function carryLabel(carriedOverCount: number): string | null {
  if (carriedOverCount < 1) return null
  // Arrastrada una vez = va por su segunda semana en el planificador.
  return `${carriedOverCount + 1}ª semana`
}

/* ── Zonas de soltado del drag & drop ─────────────────────────────────────── */

export type DropTarget =
  | { kind: 'inbox' }
  | { kind: 'day'; day: IsoWeekday }
  | { kind: 'slot'; day: IsoWeekday; block: number }

/** 'inbox' · 'day:3' · 'slot:3:20'. */
export function dropTargetId(target: DropTarget): string {
  if (target.kind === 'inbox') return 'inbox'
  if (target.kind === 'day') return `day:${target.day}`
  return `slot:${target.day}:${target.block}`
}

/**
 * Inversa de dropTargetId; null si el id no nombra una zona válida.
 * Puro y testeado a propósito: así el onDragEnd no acaba siendo un nido de
 * split(':') sin cubrir.
 */
export function parseDropTargetId(id: string): DropTarget | null {
  if (id === 'inbox') return { kind: 'inbox' }
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
