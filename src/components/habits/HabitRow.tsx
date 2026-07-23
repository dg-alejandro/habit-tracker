import { toggleCheck } from '../../data/repositories/entriesRepo'
import type { IsoDate } from '../../logic/dates'
import type { DayEntry, Habit } from '../../data/types'
import { CheckToggle } from './CheckToggle'
import { CounterControls } from './CounterControls'
import { NoteField } from './NoteField'

interface HabitRowProps {
  habit: Habit
  entry: DayEntry | undefined
  date: IsoDate
  disabled: boolean
}

/** Una fila de hábito en el registro diario, según su tipo. */
export function HabitRow({ habit, entry, date, disabled }: HabitRowProps) {
  const done = entry?.done === true

  // Casilla: la fila entera es el objetivo táctil, cómoda con el pulgar.
  if (habit.type === 'check') {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={done}
        onClick={() => void toggleCheck(habit.id, date)}
        className="flex min-h-14 w-full items-center gap-4 py-2 text-left"
      >
        <CheckToggle checked={done} />
        <span className="text-base text-ink">{habit.name}</span>
      </button>
    )
  }

  // Contadores: el check es un indicador pasivo; se cumple sumando minutos.
  return (
    <div className="flex min-h-14 items-start gap-4 py-3">
      <CheckToggle checked={done} />
      <div className="min-w-0 flex-1">
        <p className="text-base leading-7 text-ink">{habit.name}</p>
        <CounterControls habit={habit} entry={entry} date={date} disabled={disabled} />
        {habit.type === 'counter_note' && (
          <NoteField habit={habit} entry={entry} date={date} disabled={disabled} />
        )}
      </div>
    </div>
  )
}
