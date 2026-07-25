import { weekdayInitialEs, weekdayLongEs } from '../../logic/dates'
import type { IsoWeekday } from '../../data/types'

interface MobileDayPagerProps {
  selected: IsoWeekday
  today: IsoWeekday | null
  /** Tareas pendientes por día, para el punto indicador. */
  pendingByDay: ReadonlyMap<IsoWeekday, number>
  onSelect: (day: IsoWeekday) => void
}

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

/** En móvil se ve un día cada vez (§4): esta tira elige cuál. */
export function MobileDayPager({ selected, today, pendingByDay, onSelect }: MobileDayPagerProps) {
  return (
    <nav aria-label="Elegir día" className="mt-4 grid grid-cols-7 gap-1">
      {WEEKDAYS.map((day) => {
        const active = day === selected
        const pending = pendingByDay.get(day) ?? 0
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-current={active ? 'true' : undefined}
            aria-label={`${weekdayLongEs(day)}${day === today ? ' (hoy)' : ''}`}
            className={`flex h-11 flex-col items-center justify-center rounded-lg border text-xs transition-colors ${
              active
                ? 'border-ink bg-ink font-semibold text-paper'
                : `border-line hover:bg-surface ${day === today ? 'font-semibold text-ink' : 'text-ink-soft'}`
            }`}
          >
            <span aria-hidden="true">{weekdayInitialEs(day)}</span>
            <span
              aria-hidden="true"
              className={`mt-0.5 h-1 w-1 rounded-full ${
                pending > 0 ? (active ? 'bg-paper' : 'bg-ink-soft') : 'bg-transparent'
              }`}
            />
          </button>
        )
      })}
    </nav>
  )
}
