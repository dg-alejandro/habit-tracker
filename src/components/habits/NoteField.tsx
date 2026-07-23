import { setNote } from '../../data/repositories/entriesRepo'
import type { IsoDate } from '../../logic/dates'
import type { DayEntry, Habit } from '../../data/types'

interface NoteFieldProps {
  habit: Habit
  entry: DayEntry | undefined
  date: IsoDate
  disabled: boolean
}

/**
 * Nota libre del día (counter_note): el contenido queda en el historial.
 * Campo no controlado que persiste al salir o con Enter; vaciarlo borra la nota.
 */
export function NoteField({ habit, entry, date, disabled }: NoteFieldProps) {
  const saved = entry?.note ?? ''

  return (
    <input
      // Remontar al cambiar de día o al llegar la nota guardada mantiene defaultValue al día.
      key={`${date}:${saved}`}
      type="text"
      defaultValue={saved}
      disabled={disabled}
      placeholder="Nota del día (tema estudiado…)"
      aria-label={`Nota de ${habit.name}`}
      onBlur={(event) => {
        const value = event.currentTarget.value
        if (value.trim() !== saved) void setNote(habit.id, date, value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      className="mt-2 h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-faint"
    />
  )
}
