import { createTask } from '../../data/repositories/plannerTasksRepo'
import { formatDateShortEs, weekdayShortEs, type IsoDate } from '../../logic/dates'
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
}

/** Cabecera del día, alta rápida y sus tareas sin hora asignada. */
export function DayLane({
  weekId,
  day,
  date,
  isToday,
  tasks,
  editingId,
  onEdit,
}: DayLaneProps) {
  return (
    <section className="min-w-0">
      <h3 className="flex items-baseline gap-2">
        <span className={`text-sm capitalize ${isToday ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
          {weekdayShortEs(day)}
        </span>
        <span className="truncate text-xs text-ink-faint">{formatDateShortEs(date)}</span>
      </h3>
      <div className="mt-2">
        <QuickAddField
          placeholder="Añadir y Enter"
          onSubmit={(text) => void createTask({ text, weekId, day })}
        />
      </div>
      <div className="mt-1">
        <TaskList tasks={tasks} editingId={editingId} onEdit={onEdit} />
      </div>
    </section>
  )
}
