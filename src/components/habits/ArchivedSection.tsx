import { unarchiveHabit } from '../../data/repositories/habitsRepo'
import type { Habit } from '../../data/types'

interface ArchivedSectionProps {
  habits: Habit[]
}

/** Hábitos archivados: fuera de la vista diaria, pero con historial intacto. */
export function ArchivedSection({ habits }: ArchivedSectionProps) {
  if (habits.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="text-xs font-medium uppercase tracking-widest text-ink-soft">Archivados</h2>
      <ul className="mt-2 divide-y divide-line">
        {habits.map((habit) => (
          <li key={habit.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
            <p className="truncate text-base text-ink-faint">{habit.name}</p>
            <button
              type="button"
              onClick={() => void unarchiveHabit(habit.id)}
              className="h-11 shrink-0 rounded-lg px-2 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              Desarchivar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
