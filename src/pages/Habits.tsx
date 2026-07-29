import { useState } from 'react'
import { ArchivedSection } from '../components/habits/ArchivedSection'
import { FrozenRangesSection } from '../components/habits/FrozenRangesSection'
import { HabitForm, type HabitFormValues } from '../components/habits/HabitForm'
import { SortableHabitList } from '../components/habits/SortableHabitList'
import { PageTitle } from '../components/ui/PageTitle'
import { SkeletonRows } from '../components/ui/Skeleton'
import { BUTTON_PRIMARY } from '../components/ui/classes'
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
      <PageTitle
        action={
          !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={`shrink-0 ${BUTTON_PRIMARY}`}
            >
              Nuevo hábito
            </button>
          )
        }
      >
        Hábitos
      </PageTitle>

      {creating && (
        <div className="mt-4">
          <HabitForm onSubmit={submitCreate} onCancel={() => setCreating(false)} />
        </div>
      )}

      {habits === undefined ? (
        <SkeletonRows className="mt-6" />
      ) : (
        <>
          <SortableHabitList habits={active} />
          <ArchivedSection habits={archived} />
        </>
      )}
      <FrozenRangesSection />
    </div>
  )
}
