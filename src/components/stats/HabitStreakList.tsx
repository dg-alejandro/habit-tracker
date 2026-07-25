import { useMemo } from 'react'
import { computeHabitStreak, computeHabitWeeklyStreak } from '../../logic/streaks'
import type { IsoDate } from '../../logic/dates'
import type { DayEntry, FrozenRange, Habit } from '../../data/types'

interface HabitStreakListProps {
  /** Todos los hábitos: activos y archivados (estos, al final y atenuados). */
  habits: readonly Habit[]
  entries: readonly DayEntry[]
  frozenRanges: readonly FrozenRange[]
  today: IsoDate
  onSelect: (habitId: string) => void
}

interface RowData {
  habit: Habit
  current: number
  record: number
  broken: boolean
  weeklyCurrent: number
}

/* Rachas por hábito en compacto; tocar una fila abre la vista del hábito. */
export function HabitStreakList({
  habits,
  entries,
  frozenRanges,
  today,
  onSelect,
}: HabitStreakListProps) {
  const rows = useMemo<RowData[]>(
    () =>
      habits.map((habit) => {
        const streak = computeHabitStreak({ habit, entries, frozenRanges, today })
        const weekly = computeHabitWeeklyStreak({ habit, entries, frozenRanges, today })
        return {
          habit,
          current: streak.current,
          record: streak.record,
          broken: streak.recentlyBroken !== null,
          weeklyCurrent: weekly.current,
        }
      }),
    [habits, entries, frozenRanges, today],
  )
  const active = rows.filter((row) => row.habit.archivedAt === null)
  const archived = rows.filter((row) => row.habit.archivedAt !== null)

  return (
    <section className="mt-12">
      <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">Por hábito</h2>
      {active.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Sin hábitos activos.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {active.map((row) => (
            <Row key={row.habit.id} row={row} onSelect={onSelect} />
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <>
          <h2 className="mt-8 font-display text-xs uppercase tracking-widest text-streak-lime">
            Archivados
          </h2>
          <ul className="mt-2 divide-y divide-line opacity-50">
            {archived.map((row) => (
              <Row key={row.habit.id} row={row} onSelect={onSelect} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Row({ row, onSelect }: { row: RowData; onSelect: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row.habit.id)}
        className="flex min-h-14 w-full items-center justify-between gap-3 text-left hover:bg-surface"
      >
        <span className="truncate text-sm text-ink">{row.habit.name}</span>
        <span className="flex shrink-0 items-center gap-3">
          <span
            className={`font-display text-3xl font-bold leading-none tabular-nums ${
              row.broken ? 'text-streak-red' : 'text-streak-orange'
            }`}
          >
            {row.current}
          </span>
          <span className="flex w-16 flex-col items-end font-display text-[11px] leading-tight tabular-nums text-ink-soft">
            <span className="text-streak-magenta">récord {row.record}</span>
            <span>{row.weeklyCurrent} sem</span>
          </span>
        </span>
      </button>
    </li>
  )
}
