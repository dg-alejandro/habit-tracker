import { formatDateShortEs, weekdayLongEs, weekdayShortEs, type IsoDate } from '../../logic/dates'
import { DropZone } from './DropZone'
import { TaskList } from './TaskList'
import type { IsoWeekday, PlannerTask } from '../../data/types'

interface DayLaneProps {
  day: IsoWeekday
  date: IsoDate
  isToday: boolean
  /** Solo las tareas de ese día SIN hora: las que la tienen viven en la cuadrícula. */
  tasks: readonly PlannerTask[]
  editingId: string | null
  onEdit: (id: string) => void
  /** 'grid' en las siete columnas de escritorio, donde no hay ancho. */
  density: 'row' | 'grid'
}

/**
 * Un día: su cabecera y las tareas colocadas ahí que no tienen hora. No hay
 * campo de escribir — las tareas se crean sueltas arriba y se arrastran aquí.
 */
export function DayLane({ day, date, isToday, tasks, editingId, onEdit, density }: DayLaneProps) {
  const pending = tasks.filter((task) => !task.done).length

  return (
    <section className="min-w-0 border-l border-line px-1.5">
      <h3
        className={`flex items-baseline gap-2 border-b pb-1 ${
          isToday ? 'border-streak-lime' : 'border-line'
        }`}
      >
        <span
          className={`font-display text-sm uppercase ${
            isToday ? 'text-streak-lime' : 'text-ink-soft'
          }`}
        >
          {weekdayShortEs(day)}
        </span>
        <span className="truncate font-display text-xs text-ink-faint">
          {formatDateShortEs(date)}
        </span>
        {pending > 0 && (
          <span className="ml-auto font-display text-xs tabular-nums text-streak-orange">
            {pending}
          </span>
        )}
      </h3>
      <DropZone
        target={{ kind: 'day', day }}
        className="mt-1 min-h-20 rounded-sm"
        label={`Soltar en ${weekdayLongEs(day)}`}
      >
        <TaskList tasks={tasks} editingId={editingId} onEdit={onEdit} density={density} />
      </DropZone>
    </section>
  )
}
