import { useState } from 'react'
import { addMinutes, setMinutes } from '../../data/repositories/entriesRepo'
import type { IsoDate } from '../../logic/dates'
import type { DayEntry, Habit } from '../../data/types'

interface CounterControlsProps {
  habit: Habit
  entry: DayEntry | undefined
  date: IsoDate
  disabled: boolean
}

/** Cantidades frecuentes para acumular sesiones (10 + 20 = 30). */
const QUICK_ADDS = [5, 10, 15, 30]

/**
 * Progreso del contador ("18/30 min") con botones rápidos para sumar.
 * Tocar la cifra abre un campo para corregir el total del día (0 = reset).
 */
export function CounterControls({ habit, entry, date, disabled }: CounterControlsProps) {
  const [editing, setEditing] = useState(false)
  const minutes = entry?.minutes ?? 0
  const target = habit.targetMinutes ?? 0

  const commit = (raw: string) => {
    const total = Number(raw)
    if (Number.isFinite(total) && total !== minutes) {
      void setMinutes(habit.id, date, total, target)
    }
    setEditing(false)
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {editing ? (
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={minutes}
          aria-label={`Minutos de ${habit.name}`}
          onBlur={(event) => commit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          className="h-9 w-20 rounded-lg border border-line bg-paper px-2 text-sm tabular-nums text-ink"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditing(true)}
          title="Corregir los minutos del día"
          className="h-9 rounded-lg px-1 text-sm font-medium tabular-nums text-ink-soft transition-colors hover:bg-surface"
        >
          {minutes}/{target} min
        </button>
      )}
      {QUICK_ADDS.map((quantity) => (
        <button
          key={quantity}
          type="button"
          disabled={disabled}
          onClick={() => void addMinutes(habit.id, date, quantity, target)}
          className="h-9 min-w-12 rounded-lg border border-line px-2 text-sm font-medium text-ink transition-colors hover:bg-surface active:bg-surface"
        >
          +{quantity}
        </button>
      ))}
    </div>
  )
}
