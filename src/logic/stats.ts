/*
 * Estadísticas. En la Fase 1, solo el porcentaje de cumplimiento de la semana
 * en curso; los agregados por semana, mes y año llegan en la Fase 3.
 * Solo funciones puras: sin React, sin I/O y sin Date.now() sin inyectar.
 */
import { isDateFrozen, isoWeekDaysOf, type IsoDate } from './dates'
import type { DayEntry, FrozenRange, Habit } from '../data/types'

/**
 * Un contador queda cumplido al alcanzar el objetivo VIGENTE en el momento de
 * escribir (editar el objetivo después no reescribe el historial). Sin objetivo
 * válido (> 0) nunca se cumple solo. La usan los repositorios al fijar `done`.
 */
export function isCounterFulfilled(minutes: number, targetMinutes: number): boolean {
  return targetMinutes > 0 && minutes >= targetMinutes
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
 * Porcentaje entero (0–100) de cumplimiento de la semana ISO de `today`,
 * contando de lunes a hoy inclusive, o null si no hay ninguna celda que contar
 * (sin hábitos, o todos los días congelados: un día congelado ni suma ni rompe).
 *
 * Celda = (hábito activo, día transcurrido no congelado con createdOn <= día).
 * Cumplida si existe un registro con done=true — se CONFÍA en `done`: los
 * contadores lo fijan al escribir y aquí no se recalcula contra el objetivo.
 * Un día sin registrar cuenta como no cumplido.
 */
export function computeWeeklyPercentage(input: WeeklyPercentageInput): number | null {
  const activeHabits = input.habits.filter((habit) => habit.archivedAt === null)
  const openDays = isoWeekDaysOf(input.today).filter(
    (day) => day <= input.today && !isDateFrozen(day, input.frozenRanges),
  )

  const fulfilledCells = new Set<string>()
  for (const entry of input.entries) {
    if (entry.done) fulfilledCells.add(`${entry.habitId}|${entry.date}`)
  }

  let cells = 0
  let fulfilled = 0
  for (const habit of activeHabits) {
    for (const day of openDays) {
      if (day < habit.createdOn) continue
      cells += 1
      if (fulfilledCells.has(`${habit.id}|${day}`)) fulfilled += 1
    }
  }

  if (cells === 0) return null
  return Math.round((fulfilled / cells) * 100)
}
