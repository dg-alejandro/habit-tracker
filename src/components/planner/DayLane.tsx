import { createTask } from '../../data/repositories/plannerTasksRepo'
import { formatDateShortEs, weekdayLongEs, weekdayShortEs, type IsoDate } from '../../logic/dates'
import { DropZone } from './DropZone'
import { QuickAddField } from './QuickAddField'
import { TaskList } from './TaskList'
import type { IsoWeekday, PlannerTask, WeekId } from '../../data/types'

interface DayLaneProps {
  weekId: WeekId
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
 * Un día: su cabecera, el campo de crear tareas y sus tareas sin hora.
 * Aquí nace toda tarea breve — no hay bandeja intermedia, se escribe
 * directamente en el día al que pertenece.
 */
export function DayLane({
  weekId,
  day,
  date,
  isToday,
  tasks,
  editingId,
  onEdit,
  density,
}: DayLaneProps) {
  const pending = tasks.filter((task) => !task.done).length

  return (
    <section className="min-w-0">
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
          <span className="ml-auto font-display text-xs tabular-nums text-ink-faint">
            {pending}
          </span>
        )}
      </h3>
      <div className="mt-2">
        <QuickAddField
          placeholder="Añadir y Enter"
          label={`Añadir tarea al ${weekdayLongEs(day)}`}
          onSubmit={(text) => void createTask({ text, weekId, day })}
        />
      </div>
      <DropZone target={{ kind: 'day', day }} className="mt-1 min-h-14 rounded-sm">
        <TaskList tasks={tasks} editingId={editingId} onEdit={onEdit} density={density} />
      </DropZone>
    </section>
  )
}
