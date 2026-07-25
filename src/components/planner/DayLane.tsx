import { createTask } from '../../data/repositories/plannerTasksRepo'
import {
  formatDateShortEs,
  weekdayLongEs,
  weekdayShortEs,
  type IsoDate,
} from '../../logic/dates'
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

/** Cabecera del día, alta rápida y sus tareas sin hora asignada. */
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
          label={`Añadir tarea al ${weekdayLongEs(day)}`}
          onSubmit={(text) => void createTask({ text, weekId, day })}
        />
      </div>
      <DropZone target={{ kind: 'day', day }} className="mt-1 min-h-14 rounded-lg">
        <TaskList tasks={tasks} editingId={editingId} onEdit={onEdit} density={density} />
      </DropZone>
    </section>
  )
}
