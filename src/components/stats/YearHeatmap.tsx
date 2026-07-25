import { useEffect, useRef } from 'react'
import { formatMonthShortEs, isoWeekDaysOf, type IsoDate } from '../../logic/dates'
import type { Habit } from '../../data/types'

export interface HeatmapCell {
  date: IsoDate
  className: string
  title: string
}

interface YearHeatmapProps {
  year: number
  /** Años navegables (los que tienen historial), en orden ascendente. */
  years: number[]
  onYearChange: (year: number) => void
  /** Una celda por día del año natural, en orden cronológico. */
  cells: HeatmapCell[]
}

const COLUMN_PX = 12 // celda de 10px + hueco de 2px

/** Años con historial: del primer createdOn al año de hoy. */
export function availableYears(habits: readonly Habit[], today: IsoDate): number[] {
  const first = habits.map((habit) => habit.createdOn).sort()[0]
  const currentYear = Number(today.slice(0, 4))
  const firstYear = first === undefined ? currentYear : Number(first.slice(0, 4))
  const years: number[] = []
  for (let year = firstYear; year <= currentYear; year += 1) years.push(year)
  return years
}

const WEEKDAY_LABELS = ['L', '', 'X', '', 'V', '', '']

/*
 * Heatmap anual tipo GitHub en CSS puro: columnas = semanas, lunes arriba.
 * En móvil scrollea en horizontal y arranca pegado al final, con hoy a la vista.
 */
export function YearHeatmap({ year, years, onYearChange, cells }: YearHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el !== null) el.scrollLeft = el.scrollWidth
  }, [year, cells.length])

  // Huecos hasta el primer lunes: posición del 1 de enero dentro de su semana.
  const firstDay = `${year}-01-01`
  const leadingBlanks = isoWeekDaysOf(firstDay).indexOf(firstDay)

  const monthLabels: { id: string; label: string; left: number }[] = []
  cells.forEach((cell, index) => {
    if (cell.date.endsWith('-01')) {
      monthLabels.push({
        id: cell.date.slice(0, 7),
        label: formatMonthShortEs(cell.date.slice(0, 7)),
        left: Math.floor((leadingBlanks + index) / 7) * COLUMN_PX,
      })
    }
  })

  const canPrev = years.includes(year - 1)
  const canNext = years.includes(year + 1)

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">
          Mapa del año
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Año anterior"
            disabled={!canPrev}
            onClick={() => onYearChange(year - 1)}
            className="h-11 w-11 rounded-sm text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-30"
          >
            ←
          </button>
          <span className="text-sm font-semibold tabular-nums text-ink">{year}</span>
          <button
            type="button"
            aria-label="Año siguiente"
            disabled={!canNext}
            onClick={() => onYearChange(year + 1)}
            className="h-11 w-11 rounded-sm text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="grid shrink-0 grid-rows-7 gap-0.5 pt-5" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, index) => (
            <span
              key={index}
              className="flex h-2.5 items-center text-[9px] leading-none text-ink-faint"
            >
              {label}
            </span>
          ))}
        </div>
        <div ref={scrollRef} className="overflow-x-auto pb-1">
          <div className="relative w-max pt-5">
            {monthLabels.map((month) => (
              <span
                key={month.id}
                className="absolute top-0 text-[10px] text-ink-faint"
                style={{ left: month.left }}
              >
                {month.label}
              </span>
            ))}
            <div className="grid grid-flow-col grid-rows-7 gap-0.5">
              {Array.from({ length: leadingBlanks }, (_, index) => (
                <span key={`blank-${index}`} className="h-2.5 w-2.5" />
              ))}
              {cells.map((cell) => (
                <span
                  key={cell.date}
                  role="img"
                  aria-label={cell.title}
                  title={cell.title}
                  className={`h-2.5 w-2.5 rounded-[2px] ${cell.className}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
