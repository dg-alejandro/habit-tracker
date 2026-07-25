import { toggleTaskDone } from '../../data/repositories/plannerTasksRepo'
import { sortTasksForDisplay } from '../../logic/planner'
import { DraggableTask } from './DropZone'
import { TaskChip } from './TaskChip'
import type { PlannerTask } from '../../data/types'

interface TaskListProps {
  tasks: readonly PlannerTask[]
  editingId: string | null
  onEdit: (id: string) => void
  emptyLabel?: string
}

/**
 * Lista de tareas del inbox o de un día. El editor NO se abre aquí dentro: en
 * escritorio una columna es un séptimo de la pantalla y el formulario no cabe,
 * así que vive en una banda a ancho completo de la página.
 */
export function TaskList({ tasks, editingId, onEdit, emptyLabel }: TaskListProps) {
  const ordered = sortTasksForDisplay(tasks)

  if (ordered.length === 0) {
    return emptyLabel === undefined ? null : (
      <p className="py-2 text-sm text-ink-faint">{emptyLabel}</p>
    )
  }

  return (
    <ul className="divide-y divide-line">
      {ordered.map((task) => (
        <li key={task.id} className={editingId === task.id ? 'bg-surface' : ''}>
          <DraggableTask task={task} density="row">
            {(handle) => (
              <TaskChip
                task={task}
                density="row"
                handle={handle}
                onToggle={() => void toggleTaskDone(task.id)}
                onOpen={() => onEdit(task.id)}
              />
            )}
          </DraggableTask>
        </li>
      ))}
    </ul>
  )
}
