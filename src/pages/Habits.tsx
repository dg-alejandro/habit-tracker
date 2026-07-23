import { useState } from 'react'
import { ArchivedSection } from '../components/habits/ArchivedSection'
import { FrozenRangesSection } from '../components/habits/FrozenRangesSection'
import { HabitForm, type HabitFormValues } from '../components/habits/HabitForm'
import { SortableHabitList } from '../components/habits/SortableHabitList'
import { createHabit } from '../data/repositories/habitsRepo'
import { useAllHabits } from '../hooks/useHabits'

/* Gestión de hábitos: crear, editar, reordenar, archivar y rangos congelados (CLAUDE.md §5.2). */
export function Habits() {
  const habits = useAllHabits()
  const [creating, setCreating] = useState(false)

  const active = (habits ?? []).filter((habit) => habit.archivedAt === null)
  const archived = (habits ?? []).filter((habit) => habit.archivedAt !== null)

  const submitCreate = (values: HabitFormValues) => {
    void createHabit(values)
    setCreating(false)
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-6 md:px-10 md:py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Hábitos</h1>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-11 shrink-0 rounded-lg bg-ink px-4 text-sm font-semibold text-paper"
          >
            Nuevo hábito
          </button>
        )}
      </div>

      {creating && (
        <div className="mt-4">
          <HabitForm onSubmit={submitCreate} onCancel={() => setCreating(false)} />
        </div>
      )}

      {habits !== undefined && <SortableHabitList habits={active} />}
      {habits !== undefined && <ArchivedSection habits={archived} />}
      <FrozenRangesSection />
    </div>
  )
}
