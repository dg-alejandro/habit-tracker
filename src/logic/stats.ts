/*
 * Estadísticas: porcentaje de la semana en curso, series de evolución por
 * semana/mes/año y datos de los heatmaps anuales (Fase 3).
 * Solo funciones puras: sin React, sin I/O y sin Date.now() sin inyectar.
 */
import {
  addDaysIso,
  addMonthsToMonthId,
  daysOfMonth,
  eachDayIso,
  formatMonthShortEs,
  isDateFrozen,
  isoWeekDaysOf,
  isoWeekIdOf,
  monthIdOf,
  type IsoDate,
} from './dates'
import type { DayEntry, FrozenRange, Habit } from '../data/types'

/**
 * Un contador queda cumplido al alcanzar el objetivo VIGENTE en el momento de
 * escribir (editar el objetivo después no reescribe el historial). Sin objetivo
 * válido (> 0) nunca se cumple solo. La usan los repositorios al fijar `done`.
 */
export function isCounterFulfilled(minutes: number, targetMinutes: number): boolean {
  return targetMinutes > 0 && minutes >= targetMinutes
}

export interface CompletionCellsInput {
  /**
   * SIN filtro de archivados aquí: el caller decide la política. La vista
   * global pasa solo activos; la vista por hábito pasa [habit] aunque esté
   * archivado ("archivar conserva estadísticas").
   */
  habits: readonly Habit[]
  /** Cualquier superconjunto vale: lo que no case con las celdas se ignora. */
  entries: readonly DayEntry[]
  frozenRanges: readonly FrozenRange[]
  /** Días candidatos ya acotados (p. ej. lunes..hoy). */
  days: readonly IsoDate[]
}

export interface CompletionCells {
  cells: number
  fulfilled: number
}

/**
 * La ÚNICA definición de "celda" de la app — el % semanal del registro diario
 * y todos los agregados de estadísticas salen de aquí.
 *
 * Celda = (hábito, día no congelado con createdOn <= día). Cumplida si existe
 * un registro con done=true — se CONFÍA en `done`: los contadores lo fijan al
 * escribir y aquí no se recalcula contra el objetivo. Un día sin registrar
 * cuenta como no cumplido; un día congelado ni suma ni rompe (sale de ambos
 * lados de la división).
 */
export function countCompletionCells(input: CompletionCellsInput): CompletionCells {
  const openDays = input.days.filter((day) => !isDateFrozen(day, input.frozenRanges))

  const fulfilledCells = new Set<string>()
  for (const entry of input.entries) {
    if (entry.done) fulfilledCells.add(`${entry.habitId}|${entry.date}`)
  }

  let cells = 0
  let fulfilled = 0
  for (const habit of input.habits) {
    for (const day of openDays) {
      if (day < habit.createdOn) continue
      cells += 1
      if (fulfilledCells.has(`${habit.id}|${day}`)) fulfilled += 1
    }
  }
  return { cells, fulfilled }
}

/** Porcentaje entero 0–100, o null si no hay ninguna celda que contar. */
export function cellsPercentage(count: CompletionCells): number | null {
  if (count.cells === 0) return null
  return Math.round((count.fulfilled / count.cells) * 100)
}

export interface WeeklyPercentageInput {
  /** Puede incluir archivados: se filtran aquí dentro (defensivo). */
  habits: readonly Habit[]
  /** Cualquier superconjunto vale: lo que no sea de la semana se ignora. */
  entries: readonly DayEntry[]
  frozenRanges: readonly FrozenRange[]
  /** Día lógico actual. */
  today: IsoDate
}

/**
 * Porcentaje de cumplimiento de la semana ISO de `today`, contando de lunes a
 * hoy inclusive, o null si no hay celdas (sin hábitos o todo congelado).
 */
export function computeWeeklyPercentage(input: WeeklyPercentageInput): number | null {
  const activeHabits = input.habits.filter((habit) => habit.archivedAt === null)
  const days = isoWeekDaysOf(input.today).filter((day) => day <= input.today)
  return cellsPercentage(
    countCompletionCells({
      habits: activeHabits,
      entries: input.entries,
      frozenRanges: input.frozenRanges,
      days,
    }),
  )
}

export interface SeriesInput {
  /** Vista global: pasar SOLO activos. Vista por hábito: [habit], archivado o no. */
  habits: readonly Habit[]
  entries: readonly DayEntry[]
  frozenRanges: readonly FrozenRange[]
  today: IsoDate
}

export interface PeriodPoint {
  /** Clave estable y ordenable: '2026-W31' | '2026-07' | '2026'. */
  id: string
  /** Etiqueta del eje: 'S31' | 'jul' | '2026'. */
  label: string
  /** 0–100, o null si el periodo no tiene celdas (congelado o sin historial). */
  percentage: number | null
}

function periodPercentage(input: SeriesInput, days: readonly IsoDate[]): number | null {
  return cellsPercentage(
    countCompletionCells({
      habits: input.habits,
      entries: input.entries,
      frozenRanges: input.frozenRanges,
      days,
    }),
  )
}

/** Las 12 últimas semanas ISO, la actual incluida (parcial), en orden cronológico. */
export function computeWeeklySeries(input: SeriesInput): PeriodPoint[] {
  const points: PeriodPoint[] = []
  for (let back = 11; back >= 0; back -= 1) {
    const anchor = addDaysIso(input.today, -7 * back)
    const days = isoWeekDaysOf(anchor).filter((day) => day <= input.today)
    const id = isoWeekIdOf(anchor)
    points.push({ id, label: `S${id.slice(-2)}`, percentage: periodPercentage(input, days) })
  }
  return points
}

/** Los 12 últimos meses naturales, el actual incluido (parcial). */
export function computeMonthlySeries(input: SeriesInput): PeriodPoint[] {
  const currentMonth = monthIdOf(input.today)
  const points: PeriodPoint[] = []
  for (let back = 11; back >= 0; back -= 1) {
    const id = addMonthsToMonthId(currentMonth, -back)
    const days = daysOfMonth(id).filter((day) => day <= input.today)
    points.push({ id, label: formatMonthShortEs(id), percentage: periodPercentage(input, days) })
  }
  return points
}

/** Años naturales desde el del primer createdOn hasta el de today; [] sin hábitos. */
export function computeYearlySeries(input: SeriesInput): PeriodPoint[] {
  const firstCreated = input.habits.map((habit) => habit.createdOn).sort()[0]
  if (firstCreated === undefined) return []
  const firstYear = Number(firstCreated.slice(0, 4))
  const currentYear = Number(input.today.slice(0, 4))
  const points: PeriodPoint[] = []
  for (let year = firstYear; year <= currentYear; year += 1) {
    const lastDay = `${year}-12-31` < input.today ? `${year}-12-31` : input.today
    const days = eachDayIso(`${year}-01-01`, lastDay)
    points.push({ id: String(year), label: String(year), percentage: periodPercentage(input, days) })
  }
  return points
}

export type GlobalHeatmapStatus = 'open' | 'frozen' | 'no-eligible' | 'future'

/** Intensidad de la celda del heatmap; 4 ⟺ el día alcanza el umbral global. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4

export interface GlobalHeatmapDay {
  date: IsoDate
  status: GlobalHeatmapStatus
  /** Los cuatro solo con status 'open'; null en el resto. */
  fulfilled: number | null
  eligible: number | null
  ratio: number | null
  level: HeatLevel | null
}

export interface GlobalHeatmapInput {
  /** Archivados se filtran DENTRO: el heatmap global es solo de activos. */
  habits: readonly Habit[]
  entries: readonly DayEntry[]
  frozenRanges: readonly FrozenRange[]
  today: IsoDate
  /** Umbral 0–1: nivel 4 ⟺ día logrado, el mismo criterio que la racha global. */
  threshold: number
  /** Año natural a pintar (365/366 días, cronológico). */
  year: number
}

/** Se evalúa umbral antes que los tramos fijos: ningún umbral crea rangos vacíos. */
function heatLevel(ratio: number, threshold: number): HeatLevel {
  if (ratio === 0) return 0
  if (ratio >= threshold) return 4
  if (ratio >= 0.5) return 3
  if (ratio >= 0.25) return 2
  return 1
}

/** Un día por celda del año natural, con el % global del día y su nivel. */
export function computeGlobalHeatmap(input: GlobalHeatmapInput): GlobalHeatmapDay[] {
  const active = input.habits.filter((habit) => habit.archivedAt === null)
  const createdOns = active.map((habit) => habit.createdOn).sort()
  const activeIds = new Set(active.map((habit) => habit.id))

  const doneByDay = new Map<IsoDate, Set<string>>()
  for (const entry of input.entries) {
    if (!entry.done || !activeIds.has(entry.habitId)) continue
    const set = doneByDay.get(entry.date)
    if (set === undefined) doneByDay.set(entry.date, new Set([entry.habitId]))
    else set.add(entry.habitId)
  }

  // Elegibles por día con un puntero sobre los createdOn ordenados (días crecientes).
  let eligibleCount = 0
  let pointer = 0

  return eachDayIso(`${input.year}-01-01`, `${input.year}-12-31`).map((date) => {
    while (pointer < createdOns.length) {
      const created = createdOns[pointer]
      if (created === undefined || created > date) break
      eligibleCount += 1
      pointer += 1
    }
    const blank = { date, fulfilled: null, eligible: null, ratio: null, level: null }
    if (eligibleCount === 0) return { ...blank, status: 'no-eligible' as const }
    // Congelado gana a futuro: los rangos congelados por adelantado se ven venir.
    if (isDateFrozen(date, input.frozenRanges)) return { ...blank, status: 'frozen' as const }
    if (date > input.today) return { ...blank, status: 'future' as const }
    const fulfilled = doneByDay.get(date)?.size ?? 0
    const ratio = fulfilled / eligibleCount
    return {
      date,
      status: 'open' as const,
      fulfilled,
      eligible: eligibleCount,
      ratio,
      level: heatLevel(ratio, input.threshold),
    }
  })
}

export type HabitHeatmapStatus =
  | 'done'
  | 'partial'
  | 'failed'
  | 'pending'
  | 'frozen'
  | 'before-creation'
  | 'future'

export interface HabitHeatmapDay {
  date: IsoDate
  status: HabitHeatmapStatus
  /** Minutos del registro si los hay (tooltip 18/30 de contadores). */
  minutes: number | null
}

export interface HabitHeatmapInput {
  habit: Habit
  entries: readonly DayEntry[]
  frozenRanges: readonly FrozenRange[]
  today: IsoDate
  year: number
}

/** Un día por celda del año natural para un hábito. Hoy vacío NUNCA es fallo. */
export function computeHabitHeatmap(input: HabitHeatmapInput): HabitHeatmapDay[] {
  const entriesByDay = new Map<IsoDate, DayEntry>()
  for (const entry of input.entries) {
    if (entry.habitId === input.habit.id) entriesByDay.set(entry.date, entry)
  }

  return eachDayIso(`${input.year}-01-01`, `${input.year}-12-31`).map((date) => {
    if (date < input.habit.createdOn) return { date, status: 'before-creation' as const, minutes: null }
    if (isDateFrozen(date, input.frozenRanges)) return { date, status: 'frozen' as const, minutes: null }
    if (date > input.today) return { date, status: 'future' as const, minutes: null }
    const entry = entriesByDay.get(date)
    const minutes = entry?.minutes ?? null
    if (entry?.done === true) return { date, status: 'done' as const, minutes }
    if ((entry?.minutes ?? 0) > 0) return { date, status: 'partial' as const, minutes }
    if (date === input.today) return { date, status: 'pending' as const, minutes: null }
    return { date, status: 'failed' as const, minutes: null }
  })
}
