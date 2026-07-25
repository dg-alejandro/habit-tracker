import { useMemo, useState } from 'react'
import {
  computeHabitStreak,
  computeHabitWeeklyStreak,
  type WeeklyStreakResult,
} from '../../logic/streaks'
import { computeHabitHeatmap } from '../../logic/stats'
import type { IsoDate } from '../../logic/dates'
import type { Habit } from '../../data/types'
import type { StatsData } from '../../hooks/useStatsData'
import { StreakHero } from './StreakHero'
import { EvolutionChart } from './EvolutionChart'
import { YearHeatmap, availableYears } from './YearHeatmap'
import { habitHeatmapCells } from './heatmapStyles'
import { NotesHistory } from './NotesHistory'

interface HabitStatsViewProps {
  habit: Habit
  data: StatsData
  today: IsoDate
  onBack: () => void
}

/* Vista de un hábito: racha, racha semanal, evolución, mapa del año y notas. */
export function HabitStatsView({ habit, data, today, onBack }: HabitStatsViewProps) {
  const { entries, frozenRanges } = data
  const streak = useMemo(
    () => computeHabitStreak({ habit, entries, frozenRanges, today }),
    [habit, entries, frozenRanges, today],
  )
  const weekly = useMemo(
    () => computeHabitWeeklyStreak({ habit, entries, frozenRanges, today }),
    [habit, entries, frozenRanges, today],
  )
  const years = useMemo(() => availableYears([habit], today), [habit, today])
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const heatmap = useMemo(
    () =>
      habitHeatmapCells(
        computeHabitHeatmap({ habit, entries, frozenRanges, today, year }),
        habit.targetMinutes,
      ),
    [habit, entries, frozenRanges, today, year],
  )
  const seriesInput = useMemo(
    () => ({ habits: [habit], entries, frozenRanges, today }),
    [habit, entries, frozenRanges, today],
  )

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-11 items-center text-sm text-ink-soft hover:text-ink hover:underline"
      >
        ← Todos los hábitos
      </button>
      <h1 className="mt-2 font-display text-2xl uppercase tracking-widest text-ink">
        {habit.name}
        {habit.archivedAt !== null && (
          <span className="ml-2 text-sm font-normal text-ink-faint">archivado</span>
        )}
      </h1>
      <div className="mt-8">
        <StreakHero label="Racha actual" streak={streak} accentClass="text-streak-orange" />
      </div>
      <WeeklyStreakLine weekly={weekly} />
      <EvolutionChart input={seriesInput} />
      <YearHeatmap year={year} years={years} onYearChange={setYear} cells={heatmap} />
      {habit.type === 'counter_note' && <NotesHistory habit={habit} entries={entries} />}
    </>
  )
}

const WEEK_STATUS_TEXT = {
  achieved: { className: 'text-streak-lime', text: (d: number, t: number) => `Esta semana: lograda (${d}/${t})` },
  pending: { className: 'text-ink-soft', text: (d: number, t: number) => `Esta semana: ${d}/${t}, aún alcanzable` },
  lost: { className: 'font-semibold text-streak-red', text: (d: number, t: number) => `Esta semana: perdida (${d}/${t})` },
  skipped: { className: 'text-ink-faint', text: () => 'Esta semana está congelada' },
} as const

function WeeklyStreakLine({ weekly }: { weekly: WeeklyStreakResult }) {
  const { status, done, effectiveTarget } = weekly.currentWeek
  const display = WEEK_STATUS_TEXT[status]
  return (
    <section className="mt-8">
      <p className="font-display text-xs uppercase tracking-widest text-ink-soft">Racha semanal</p>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="font-display text-4xl font-bold leading-none tabular-nums text-streak-orange">
          {weekly.current}
        </p>
        <p className="text-sm text-ink-soft">
          semanas · récord{' '}
          <span className="font-display tabular-nums text-streak-magenta">{weekly.record}</span>
        </p>
      </div>
      <p className={`mt-1 text-sm ${display.className}`}>{display.text(done, effectiveTarget)}</p>
    </section>
  )
}
