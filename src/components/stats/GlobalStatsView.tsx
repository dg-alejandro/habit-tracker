import { useMemo, useState } from 'react'
import { computeGlobalStreak } from '../../logic/streaks'
import { computeGlobalHeatmap } from '../../logic/stats'
import type { IsoDate } from '../../logic/dates'
import type { StatsData } from '../../hooks/useStatsData'
import { StreakHero } from './StreakHero'
import { EvolutionChart } from './EvolutionChart'
import { YearHeatmap, availableYears } from './YearHeatmap'
import { globalHeatmapCells } from './heatmapStyles'
import { HabitStreakList } from './HabitStreakList'

interface GlobalStatsViewProps {
  data: StatsData
  today: IsoDate
  onSelectHabit: (habitId: string) => void
}

/* Vista global: racha global enorme, evolución, mapa del año y lista por hábito. */
export function GlobalStatsView({ data, today, onSelectHabit }: GlobalStatsViewProps) {
  const { habits, entries, frozenRanges, threshold } = data
  const activeHabits = useMemo(
    () => habits.filter((habit) => habit.archivedAt === null),
    [habits],
  )
  const streak = useMemo(
    () => computeGlobalStreak({ habits, entries, frozenRanges, today, threshold }),
    [habits, entries, frozenRanges, today, threshold],
  )
  // Solo activos: el heatmap global filtra archivados, el selector debe coincidir.
  const years = useMemo(() => availableYears(activeHabits, today), [activeHabits, today])
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const heatmap = useMemo(
    () =>
      globalHeatmapCells(
        computeGlobalHeatmap({ habits, entries, frozenRanges, today, threshold, year }),
      ),
    [habits, entries, frozenRanges, today, threshold, year],
  )
  const seriesInput = useMemo(
    () => ({ habits: activeHabits, entries, frozenRanges, today }),
    [activeHabits, entries, frozenRanges, today],
  )

  if (habits.length === 0) {
    return (
      <>
        <h1 className="border-b border-line pb-4 font-display text-3xl uppercase tracking-[0.2em] text-ink">Rachas y estadísticas</h1>
        <p className="mt-6 text-sm text-ink-soft">
          Sin hábitos todavía. Crea el primero en la pestaña Hábitos.
        </p>
      </>
    )
  }

  return (
    <>
      <h1 className="border-b border-line pb-4 font-display text-3xl uppercase tracking-[0.2em] text-ink">Rachas y estadísticas</h1>
      <div className="mt-8">
        <StreakHero label="Racha global" streak={streak} />
      </div>
      <EvolutionChart input={seriesInput} />
      <YearHeatmap year={year} years={years} onYearChange={setYear} cells={heatmap} />
      <HabitStreakList
        habits={habits}
        entries={entries}
        frozenRanges={frozenRanges}
        today={today}
        onSelect={onSelectHabit}
      />
    </>
  )
}
