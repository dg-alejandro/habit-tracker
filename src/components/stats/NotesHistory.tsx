import { useMemo } from 'react'
import { formatMonthShortEs, monthIdOf } from '../../logic/dates'
import type { DayEntry, Habit } from '../../data/types'

interface NotesHistoryProps {
  habit: Habit
  entries: readonly DayEntry[]
}

interface MonthGroup {
  id: string
  label: string
  notes: { date: string; day: string; text: string }[]
}

/* Historial de las notas del hábito (aprendizaje): qué se estudió cada día. */
export function NotesHistory({ habit, entries }: NotesHistoryProps) {
  const groups = useMemo<MonthGroup[]>(() => {
    const noted = entries
      .filter(
        (entry) =>
          entry.habitId === habit.id && entry.note !== undefined && entry.note.trim() !== '',
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    const result: MonthGroup[] = []
    for (const entry of noted) {
      const id = monthIdOf(entry.date)
      let group = result[result.length - 1]
      if (group === undefined || group.id !== id) {
        group = { id, label: `${formatMonthShortEs(id)} ${id.slice(0, 4)}`, notes: [] }
        result.push(group)
      }
      group.notes.push({ date: entry.date, day: entry.date.slice(8), text: entry.note ?? '' })
    }
    return result
  }, [entries, habit.id])

  return (
    <section className="mt-12">
      <h2 className="text-xs font-medium uppercase tracking-widest text-ink-soft">Notas</h2>
      {groups.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Sin notas todavía.</p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="mt-4">
            <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
            <ul className="mt-1 divide-y divide-line">
              {group.notes.map((note) => (
                <li key={note.date} className="flex gap-3 py-2">
                  <span className="w-8 shrink-0 pt-0.5 text-right text-xs tabular-nums text-ink-soft">
                    {note.day}
                  </span>
                  <span className="text-sm text-ink">{note.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
