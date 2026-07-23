import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { archiveHabit, reorderHabits, updateHabit } from '../../data/repositories/habitsRepo'
import type { Habit } from '../../data/types'
import { HabitForm, type HabitFormValues } from './HabitForm'

interface SortableHabitListProps {
  habits: Habit[]
}

/** Lista de hábitos activos: reordenar arrastrando el asa, editar en línea y archivar. */
export function SortableHabitList({ habits }: SortableHabitListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  // Orden optimista tras soltar: evita el parpadeo mientras la escritura aterriza.
  const [pendingOrder, setPendingOrder] = useState<readonly string[] | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const displayed = useMemo(() => {
    if (pendingOrder === null) return habits
    const byId = new Map(habits.map((habit) => [habit.id, habit]))
    const ordered = pendingOrder
      .map((id) => byId.get(id))
      .filter((habit): habit is Habit => habit !== undefined)
    for (const habit of habits) {
      if (!pendingOrder.includes(habit.id)) ordered.push(habit)
    }
    return ordered
  }, [habits, pendingOrder])

  useEffect(() => {
    if (pendingOrder !== null && habits.map((h) => h.id).join('|') === pendingOrder.join('|')) {
      setPendingOrder(null)
    }
  }, [habits, pendingOrder])

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over === null || active.id === over.id) return
    const ids = displayed.map((habit) => habit.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const next = arrayMove(ids, from, to)
    setPendingOrder(next)
    void reorderHabits(next)
  }

  if (habits.length === 0) {
    return <p className="mt-6 text-sm text-ink-soft">Sin hábitos activos.</p>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={displayed.map((habit) => habit.id)} strategy={verticalListSortingStrategy}>
        <ul className="mt-4 divide-y divide-line">
          {displayed.map((habit) => (
            <SortableHabitItem
              key={habit.id}
              habit={habit}
              editing={editingId === habit.id}
              onStartEdit={() => setEditingId(habit.id)}
              onStopEdit={() => setEditingId(null)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

interface SortableHabitItemProps {
  habit: Habit
  editing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
}

function SortableHabitItem({ habit, editing, onStartEdit, onStopEdit }: SortableHabitItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  })

  const submitEdit = (values: HabitFormValues) => {
    const patch: Parameters<typeof updateHabit>[1] = {
      name: values.name,
      weeklyTarget: values.weeklyTarget,
    }
    if (values.targetMinutes !== undefined) patch.targetMinutes = values.targetMinutes
    void updateHabit(habit.id, patch)
    onStopEdit()
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-paper ${isDragging ? 'relative z-10' : ''}`}
    >
      {editing ? (
        <div className="py-3">
          <HabitForm initial={habit} onSubmit={submitEdit} onCancel={onStopEdit} />
        </div>
      ) : (
        <div className="flex min-h-14 items-center gap-1 py-2">
          <button
            type="button"
            aria-label={`Reordenar ${habit.name}`}
            {...attributes}
            {...listeners}
            className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-ink-faint active:cursor-grabbing"
          >
            <GripIcon />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base text-ink">{habit.name}</p>
            <p className="text-xs text-ink-soft">{habitMeta(habit)}</p>
          </div>
          <button
            type="button"
            onClick={onStartEdit}
            className="h-11 shrink-0 rounded-lg px-2 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => void archiveHabit(habit.id)}
            className="h-11 shrink-0 rounded-lg px-2 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
          >
            Archivar
          </button>
        </div>
      )}
    </li>
  )
}

function habitMeta(habit: Habit): string {
  const parts: string[] = []
  if (habit.type === 'check') parts.push('Casilla')
  if (habit.type === 'counter') parts.push('Contador')
  if (habit.type === 'counter_note') parts.push('Contador con nota')
  if (habit.targetMinutes !== undefined) parts.push(`${habit.targetMinutes} min`)
  parts.push(`${habit.weeklyTarget}/sem`)
  return parts.join(' · ')
}

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <circle cx="7" cy="5" r="1.5" />
      <circle cx="13" cy="5" r="1.5" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <circle cx="7" cy="15" r="1.5" />
      <circle cx="13" cy="15" r="1.5" />
    </svg>
  )
}
