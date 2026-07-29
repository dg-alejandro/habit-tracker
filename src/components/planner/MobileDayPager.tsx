import { weekdayInitialEs, weekdayLongEs } from '../../logic/dates'
import type { IsoWeekday } from '../../data/types'

interface MobileDayPagerProps {
  selected: IsoWeekday
  today: IsoWeekday | null
  /**
   * Tareas pendientes por día, para el punto indicador. `undefined` mientras
   * carga: siete puntos apagados que luego se encienden solos son ruido.
   */
  pendingByDay: ReadonlyMap<IsoWeekday, number> | undefined
  onSelect: (day: IsoWeekday) => void
}

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

/**
 * En móvil se ve un día cada vez (§4): esta tira elige cuál.
 *
 * Solo cambia de día: colocar una tarea es soltarla en una casilla concreta de
 * la cuadrícula, no en un día suelto.
 */
export function MobileDayPager({ selected, today, pendingByDay, onSelect }: MobileDayPagerProps) {
  return (
    /*
     * `flex` con suelo por botón, y no `grid-cols-7`: repartir el ancho a
     * partes iguales dejaba cada día en ~37 px en una pantalla de 320 px, por
     * debajo de los 44 px que pide §6. Con `min-w-11` la tira scrolla en las
     * pantallas más estrechas en vez de encoger los objetivos; de 360 px en
     * adelante se ve exactamente igual que antes.
     */
    <nav aria-label="Elegir día" className="mt-4 flex gap-1 overflow-x-auto">
      {WEEKDAYS.map((day) => {
        return (
          <DayButton
            key={day}
            day={day}
            active={day === selected}
            isToday={day === today}
            pending={pendingByDay?.get(day) ?? 0}
            onSelect={onSelect}
          />
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
      className={`flex h-12 min-w-11 flex-1 shrink-0 flex-col items-center justify-center rounded-sm border font-display text-base transition-colors ${
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
