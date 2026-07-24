/*
 * Rachas (CLAUDE.md §3). Funciones puras: sin React, sin I/O, `today` inyectado.
 *
 * Semántica común a todas las rachas:
 * - Un día cerrado sin cumplir (sin registro o done=false) rompe. Hoy es la
 *   excepción: pendiente ni suma ni rompe (el día no ha cerrado); cumplido suma.
 * - Un día congelado ni suma ni rompe: se salta y no consume la ventana de aviso.
 * - Los récords se RECALCULAN del historial completo (racha actual incluida),
 *   nunca se persisten: es lo único determinista con relleno retroactivo y LWW.
 * - El historial de un hábito empieza en su `createdOn`; lo anterior se ignora.
 */
import { addDaysIso, eachDayIso, isDateFrozen, isoWeekDaysOf, type IsoDate } from './dates'
import type { DayEntry, FrozenRange, Habit } from '../data/types'

/** Ventana del aviso de ruptura, en días ABIERTOS (no congelados/saltados). */
export const RECENT_BREAK_WINDOW_DAYS = 7

/** Longitud mínima de la racha perdida para que merezca aviso (1 día es ruido). */
export const RECENT_BREAK_MIN_LENGTH = 2

export interface RecentBreak {
  /** Longitud de la racha perdida, en días. */
  length: number
  /** Día que la rompió: primer día evaluable en fallo tras el último cumplido. */
  brokenOn: IsoDate
}

export interface StreakResult {
  /** Racha actual en días. Hoy pendiente no rompe; hoy cumplido suma. */
  current: number
  /** Máximo histórico, la racha actual incluida. Invariante: record >= current. */
  record: number
  /** current > 0 && current === record — empatar el récord también es récord. */
  isRecord: boolean
  /**
   * Última racha notable perdida, solo si la racha actual es 0 y la rotura
   * queda a <= RECENT_BREAK_WINDOW_DAYS días abiertos de hoy. La UI pinta
   * con esto el aviso rojo.
   */
  recentlyBroken: RecentBreak | null
}

export interface HabitStreakInput {
  /** `archivedAt` se ignora: un archivado calcula igual con su historial. */
  habit: Habit
  /** Cualquier superconjunto vale: se filtra por hábito y [createdOn..today]. */
  entries: readonly DayEntry[]
  frozenRanges: readonly FrozenRange[]
  /** Día lógico actual (el caller ya aplicó logicalDateOf). */
  today: IsoDate
}

export interface GlobalStreakInput {
  /** Puede incluir archivados: se filtran DENTRO (estado actual, retroactivo). */
  habits: readonly Habit[]
  entries: readonly DayEntry[]
  frozenRanges: readonly FrozenRange[]
  today: IsoDate
  /** Umbral 0–1 (Settings.globalThreshold; el caller resuelve el default). */
  threshold: number
}

export type CurrentWeekStatus = 'achieved' | 'pending' | 'lost' | 'skipped'

export interface WeeklyStreakResult {
  /** Semanas ISO consecutivas; la semana en curso solo suma si 'achieved'. */
  current: number
  /** Invariante: record >= current. */
  record: number
  isRecord: boolean
  /** Estado de la semana en curso, para que la UI explique por qué no crece. */
  currentWeek: {
    status: CurrentWeekStatus
    /** Días cumplidos entre los elegibles de la semana en curso. */
    done: number
    /** min(weeklyTarget, elegibles de la semana ENTERA); 0 si 'skipped'. */
    effectiveTarget: number
  }
}

function emptyStreak(): StreakResult {
  return { current: 0, record: 0, isRecord: false, recentlyBroken: null }
}

interface DailyScan {
  /** Día saltado: ni suma, ni rompe, ni consume la ventana del aviso. */
  skipped(day: IsoDate): boolean
  /** Día cumplido. Solo se consulta en días no saltados. */
  fulfilled(day: IsoDate): boolean
}

/**
 * Barrido cronológico común a las rachas diarias (por hábito y global).
 * Los callbacks se invocan en orden de fecha estrictamente creciente.
 */
function scanDaily(start: IsoDate, today: IsoDate, scan: DailyScan): StreakResult {
  let run = 0
  let best = 0
  let open = 0
  let lastBreak: { length: number; brokenOn: IsoDate; openAt: number } | null = null

  for (const day of eachDayIso(start, today)) {
    if (scan.skipped(day)) continue
    open += 1
    if (scan.fulfilled(day)) {
      run += 1
      if (run > best) best = run
    } else if (day !== today) {
      // Fallo cerrado. Hoy sin cumplir, en cambio, queda pendiente: ni suma ni rompe.
      if (run >= RECENT_BREAK_MIN_LENGTH) {
        lastBreak = { length: run, brokenOn: day, openAt: open }
      }
      run = 0
    }
  }

  // open - openAt = días abiertos DESPUÉS de la rotura, hoy incluido.
  const recentlyBroken =
    run === 0 && lastBreak !== null && open - lastBreak.openAt <= RECENT_BREAK_WINDOW_DAYS
      ? { length: lastBreak.length, brokenOn: lastBreak.brokenOn }
      : null

  return { current: run, record: best, isRecord: run > 0 && run === best, recentlyBroken }
}

/** Fechas cumplidas del hábito dentro de [createdOn..today]. */
function habitDoneDays(input: HabitStreakInput): Set<IsoDate> {
  const done = new Set<IsoDate>()
  for (const entry of input.entries) {
    if (
      entry.habitId === input.habit.id &&
      entry.done &&
      entry.date >= input.habit.createdOn &&
      entry.date <= input.today
    ) {
      done.add(entry.date)
    }
  }
  return done
}

/** Racha diaria estricta de un hábito: un fallo cerrado la devuelve a cero. */
export function computeHabitStreak(input: HabitStreakInput): StreakResult {
  if (input.today < input.habit.createdOn) return emptyStreak()
  const doneDays = habitDoneDays(input)
  return scanDaily(input.habit.createdOn, input.today, {
    skipped: (day) => isDateFrozen(day, input.frozenRanges),
    fulfilled: (day) => doneDays.has(day),
  })
}

/**
 * Racha global: días consecutivos con cumplidos/elegibles >= umbral.
 * Elegibles de un día = hábitos HOY activos con createdOn <= día (el estado
 * actual de archivado se aplica retroactivamente: no hay historial de archivado).
 */
export function computeGlobalStreak(input: GlobalStreakInput): StreakResult {
  const active = input.habits.filter((habit) => habit.archivedAt === null)
  const createdOns = active.map((habit) => habit.createdOn).sort()
  const start = createdOns[0]
  if (start === undefined || start > input.today) return emptyStreak()

  const activeIds = new Set(active.map((habit) => habit.id))
  const doneByDay = new Map<IsoDate, Set<string>>()
  for (const entry of input.entries) {
    if (!entry.done || !activeIds.has(entry.habitId)) continue
    if (entry.date < start || entry.date > input.today) continue
    const set = doneByDay.get(entry.date)
    if (set === undefined) doneByDay.set(entry.date, new Set([entry.habitId]))
    else set.add(entry.habitId)
  }

  // Elegibles por día con un puntero sobre los createdOn ordenados: O(1) amortizado.
  // Depende de que scanDaily consulte los días en orden creciente.
  let eligibleCount = 0
  let pointer = 0
  const eligibleOn = (day: IsoDate): number => {
    while (pointer < createdOns.length) {
      const created = createdOns[pointer]
      if (created === undefined || created > day) break
      eligibleCount += 1
      pointer += 1
    }
    return eligibleCount
  }

  return scanDaily(start, input.today, {
    skipped: (day) => isDateFrozen(day, input.frozenRanges) || eligibleOn(day) === 0,
    fulfilled: (day) =>
      (doneByDay.get(day)?.size ?? 0) / eligibleOn(day) >= input.threshold,
  })
}

/**
 * Racha de semanas ISO consecutivas alcanzando el objetivo semanal efectivo:
 * min(weeklyTarget, días elegibles de la semana). Una semana sin días elegibles
 * (congelada entera, o anterior a la creación) se salta: ni suma ni rompe.
 */
export function computeHabitWeeklyStreak(input: HabitStreakInput): WeeklyStreakResult {
  const skippedWeek = { status: 'skipped' as const, done: 0, effectiveTarget: 0 }
  if (input.today < input.habit.createdOn) {
    return { current: 0, record: 0, isRecord: false, currentWeek: skippedWeek }
  }

  const doneDays = habitDoneDays(input)
  const eligibleDaysOf = (monday: IsoDate): IsoDate[] =>
    isoWeekDaysOf(monday).filter(
      (day) => day >= input.habit.createdOn && !isDateFrozen(day, input.frozenRanges),
    )

  const currentMonday = weekStartOf(input.today)

  // Semanas cerradas: objetivo efectivo estricto.
  let run = 0
  let best = 0
  for (
    let monday = weekStartOf(input.habit.createdOn);
    monday < currentMonday;
    monday = addDaysIso(monday, 7)
  ) {
    const eligible = eligibleDaysOf(monday)
    if (eligible.length === 0) continue
    const target = Math.min(input.habit.weeklyTarget, eligible.length)
    const done = eligible.filter((day) => doneDays.has(day)).length
    if (done >= target) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }

  // Semana en curso: lograda suma; aún alcanzable no rompe; imposible rompe YA.
  const eligible = eligibleDaysOf(currentMonday)
  let currentWeek: WeeklyStreakResult['currentWeek']
  let current: number
  if (eligible.length === 0) {
    currentWeek = skippedWeek
    current = run
  } else {
    const target = Math.min(input.habit.weeklyTarget, eligible.length)
    const done = eligible.filter((day) => doneDays.has(day)).length
    const playable = eligible.filter((day) => day >= input.today && !doneDays.has(day)).length
    if (done >= target) {
      currentWeek = { status: 'achieved', done, effectiveTarget: target }
      current = run + 1
    } else if (done + playable >= target) {
      currentWeek = { status: 'pending', done, effectiveTarget: target }
      current = run
    } else {
      currentWeek = { status: 'lost', done, effectiveTarget: target }
      current = 0
    }
  }

  const record = Math.max(best, current)
  return { current, record, isRecord: current > 0 && current === record, currentWeek }
}

/**
 * Mínimo de hábitos cumplidos para que un día cuente con ese umbral: el menor
 * k con k/n >= umbral. Consistente con la comparación de computeGlobalStreak
 * (un ceil(umbral·n) ingenuo se equivoca con flotantes: ceil(0.8·15) = 13).
 */
export function requiredForThreshold(threshold: number, activeCount: number): number {
  if (activeCount <= 0) return 0
  let required = Math.floor(threshold * activeCount)
  while (required / activeCount < threshold) required += 1
  return required
}

function weekStartOf(date: IsoDate): IsoDate {
  const monday = isoWeekDaysOf(date)[0]
  if (monday === undefined) throw new Error(`Semana sin lunes para '${date}'`)
  return monday
}
