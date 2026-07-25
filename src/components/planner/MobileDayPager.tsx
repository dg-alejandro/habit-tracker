import { weekdayInitialEs, weekdayLongEs } from '../../logic/dates'
import { DropZone } from './DropZone'
import type { IsoWeekday } from '../../data/types'

interface MobileDayPagerProps {
  selected: IsoWeekday
  today: IsoWeekday | null
  /** Tareas pendientes por día, para el punto indicador. */
  pendingByDay: ReadonlyMap<IsoWeekday, number>
  onSelect: (day: IsoWeekday) => void
}

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

/**
 * En móvil se ve un día cada vez (§4): esta tira elige cuál.
 *
 * Cada letra es además zona de soltado, que es la única forma cómoda de mover
 * una tarea a otro día en el iPhone. El día seleccionado NO se registra aquí:
 * su carril ya está montado abajo con el mismo identificador, y dnd-kit no
 * admite dos zonas con el mismo id.
 */
export function MobileDayPager({ selected, today, pendingByDay, onSelect }: MobileDayPagerProps) {
  return (
    <nav aria-label="Elegir día" className="mt-4 grid grid-cols-7 gap-1">
      {WEEKDAYS.map((day) => {
        const button = (
          <DayButton
            day={day}
            active={day === selected}
            isToday={day === today}
            pending={pendingByDay.get(day) ?? 0}
            onSelect={onSelect}
          />
        )
        return day === selected ? (
          <div key={day}>{button}</div>
        ) : (
          <DropZone key={day} target={{ kind: 'day', day }} className="rounded-sm">
            {button}
          </DropZone>
        )
      })}
    </nav>
  )
}

interface DayButtonProps {
  day: IsoWeekday
  active: boolean
  isToday: boolean
  pending: number
  onSelect: (day: IsoWeekday) => void
}

function DayButton({ day, active, isToday, pending, onSelect }: DayButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      aria-current={active ? 'true' : undefined}
      aria-label={`${weekdayLongEs(day)}${isToday ? ' (hoy)' : ''}`}
      className={`flex h-11 w-full flex-col items-center justify-center rounded-sm border text-xs transition-colors ${
        active
          ? 'border-ink bg-ink font-semibold text-paper'
          : `border-line hover:bg-surface ${isToday ? 'text-streak-lime' : 'text-ink-soft'}`
      }`}
    >
      <span aria-hidden="true">{weekdayInitialEs(day)}</span>
      <span
        aria-hidden="true"
        className={`mt-0.5 h-1 w-1 rounded-full ${
          pending > 0 ? (active ? 'bg-paper' : 'bg-streak-orange') : 'bg-transparent'
        }`}
      />
    </button>
  )
}
