import { unarchiveHabit } from '../../data/repositories/habitsRepo'
import { BUTTON_QUIET } from '../ui/classes'
import type { Habit } from '../../data/types'

interface ArchivedSectionProps {
  habits: Habit[]
}

/** Hábitos archivados: fuera de la vista diaria, pero con historial intacto. */
export function ArchivedSection({ habits }: ArchivedSectionProps) {
  if (habits.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">Archivados</h2>
      <ul className="mt-2 divide-y divide-line">
        {habits.map((habit) => (
          <li key={habit.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
            <p className="truncate text-base text-ink-faint">{habit.name}</p>
            <button
              type="button"
              onClick={() => void unarchiveHabit(habit.id)}
              aria-label={`Desarchivar ${habit.name}`}
              className={`shrink-0 ${BUTTON_QUIET}`}
            >
              Desarchivar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
