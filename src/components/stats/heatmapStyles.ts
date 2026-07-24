/*
 * Traducción de los datos puros del heatmap a celdas visuales (clase + título).
 * Las clases son literales estáticos: Tailwind solo compila lo que ve escrito.
 */
import { formatDateShortEs } from '../../logic/dates'
import type { GlobalHeatmapDay, HabitHeatmapDay, HeatLevel } from '../../logic/stats'
import type { HeatmapCell } from './YearHeatmap'

/* Escala global: naranja creciente y el verde ácido reservado al día logrado. */
const GLOBAL_LEVEL_CLASS: Record<HeatLevel, string> = {
  0: 'bg-surface',
  1: 'bg-streak-orange/30',
  2: 'bg-streak-orange/55',
  3: 'bg-streak-orange/80',
  4: 'bg-streak-lime',
}

const FROZEN_CLASS = 'bg-ink-faint/30'
const BLANK_CLASS = 'bg-transparent'

export function globalHeatmapCells(days: readonly GlobalHeatmapDay[]): HeatmapCell[] {
  return days.map((day) => {
    const date = formatDateShortEs(day.date)
    switch (day.status) {
      case 'open':
        return {
          date: day.date,
          className: GLOBAL_LEVEL_CLASS[day.level ?? 0],
          title: `${date}: ${day.fulfilled ?? 0} de ${day.eligible ?? 0}${
            day.level === 4 ? ' — día logrado' : ''
          }`,
        }
      case 'frozen':
        return { date: day.date, className: FROZEN_CLASS, title: `${date}: congelado` }
      case 'future':
      case 'no-eligible':
        return { date: day.date, className: BLANK_CLASS, title: date }
    }
  })
}

export function habitHeatmapCells(
  days: readonly HabitHeatmapDay[],
  targetMinutes?: number,
): HeatmapCell[] {
  return days.map((day) => {
    const date = formatDateShortEs(day.date)
    switch (day.status) {
      case 'done':
        return {
          date: day.date,
          className: 'bg-streak-lime',
          title: `${date}: cumplido${day.minutes !== null ? ` (${day.minutes} min)` : ''}`,
        }
      case 'partial':
        return {
          date: day.date,
          className: 'bg-streak-orange/50',
          title: `${date}: a medias (${day.minutes ?? 0}${
            targetMinutes !== undefined ? `/${targetMinutes}` : ''
          } min)`,
        }
      case 'failed':
        return { date: day.date, className: 'bg-surface', title: `${date}: no cumplido` }
      case 'pending':
        return {
          date: day.date,
          className: 'bg-surface ring-1 ring-inset ring-ink-soft',
          title: `${date}: pendiente (hoy)`,
        }
      case 'frozen':
        return { date: day.date, className: FROZEN_CLASS, title: `${date}: congelado` }
      case 'before-creation':
      case 'future':
        return { date: day.date, className: BLANK_CLASS, title: date }
    }
  })
}
