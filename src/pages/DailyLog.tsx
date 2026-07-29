import { useState } from 'react'
import { DayNavigator } from '../components/habits/DayNavigator'
import { FrozenDayBanner } from '../components/habits/FrozenDayBanner'
import { HabitRow } from '../components/habits/HabitRow'
import { WeeklyHeader } from '../components/habits/WeeklyHeader'
import { ExportReminderBanner } from '../components/settings/ExportReminderBanner'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonRows } from '../components/ui/Skeleton'
import { freezeDay } from '../data/repositories/frozenRepo'
import { useEntriesForDate } from '../hooks/useEntries'
import { useExportReminder } from '../hooks/useExportReminder'
import { useFrozenRanges } from '../hooks/useFrozenRanges'
import { useActiveHabits } from '../hooks/useHabits'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { useWeeklyPercentage } from '../hooks/useWeeklyPercentage'
import { formatDateEs, isDateFrozen } from '../logic/dates'

/*
 * Pantalla de inicio: registro diario de hábitos (CLAUDE.md §5.1).
 * Optimizada para el caso de cada noche: abrir, marcar y cerrar en menos de un minuto.
 */
export function DailyLog() {
  const today = useLogicalToday()
  // El día visitado no sigue al salto de las 4:00: si estabas rellenando, te quedas donde estabas.
  const [viewDate, setViewDate] = useState(today)
  const habits = useActiveHabits()
  const entries = useEntriesForDate(viewDate)
  const ranges = useFrozenRanges()
  const weeklyPercent = useWeeklyPercentage(today)
  const exportReminder = useExportReminder()

  const loading = habits === undefined || entries === undefined || ranges === undefined
  const frozen = ranges !== undefined && isDateFrozen(viewDate, ranges)
  const canQuickUnfreeze = (ranges ?? []).some(
    (range) => range.startDate === viewDate && range.endDate === viewDate,
  )
  // El historial de cada hábito empieza el día de su creación: antes, no existe.
  const visibleHabits = (habits ?? []).filter((habit) => habit.createdOn <= viewDate)

  return (
    <div className="mx-auto max-w-xl px-5 py-6 md:px-10 md:py-10">
      {/* El único h1 que no se ve: §5.1 manda que lo primero en pantalla sea el
          porcentaje de la semana, así que el título vive solo para el lector. */}
      <h1 className="sr-only">Registro diario</h1>
      <WeeklyHeader percent={weeklyPercent} />
      <DayNavigator date={viewDate} today={today} onChange={setViewDate} />

      {frozen && <FrozenDayBanner date={viewDate} canQuickUnfreeze={canQuickUnfreeze} />}

      {/*
       * El flag `loading` ya existía, pero solo tapaba el texto de vacío y el
       * botón de congelar: la lista se pintaba igual. Y como los hábitos y los
       * registros son dos consultas independientes, si los hábitos llegaban
       * primero salían las catorce casillas DESMARCADAS y luego se marcaban
       * solas. De noche y medio dormido, es justo lo contrario de lo que §5.1
       * pide de esta pantalla.
       */}
      {loading ? (
        <SkeletonRows className="mt-4" />
      ) : (
        <ul
          aria-label={`Hábitos del ${formatDateEs(viewDate)}`}
          className={`mt-4 divide-y divide-line ${frozen ? 'opacity-40' : ''}`}
        >
          {visibleHabits.map((habit) => (
            <li key={habit.id}>
              <HabitRow
                habit={habit}
                entry={entries.get(habit.id)}
                date={viewDate}
                disabled={frozen}
              />
            </li>
          ))}
        </ul>
      )}

      {!loading && visibleHabits.length === 0 && (
        <EmptyState className="mt-6">
          {habits.length === 0 ? 'Sin hábitos activos.' : 'No había hábitos este día.'}
        </EmptyState>
      )}

      {!loading && !frozen && (
        <div className="mt-10">
          <button
            type="button"
            onClick={() => void freezeDay(viewDate)}
            className="inline-flex h-11 items-center text-sm text-ink-faint underline-offset-2 transition-colors hover:text-ink-soft hover:underline"
          >
            Congelar este día
          </button>
        </div>
      )}

      {exportReminder && <ExportReminderBanner />}
    </div>
  )
}
