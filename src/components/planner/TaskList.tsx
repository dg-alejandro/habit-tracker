import { toggleTaskDone } from '../../data/repositories/plannerTasksRepo'
import { sortTasksForDisplay } from '../../logic/planner'
import { DraggableTask } from './DropZone'
import { TaskChip } from './TaskChip'
import type { PlannerTask } from '../../data/types'

interface TaskListProps {
  tasks: readonly PlannerTask[]
  editingId: string | null
  onEdit: (id: string) => void
}

/**
 * Las tareas que aún no están colocadas. El editor NO se abre aquí dentro:
 * vive en una banda a ancho completo de la página, donde sí cabe.
 */
export function TaskList({ tasks, editingId, onEdit }: TaskListProps) {
  const ordered = sortTasksForDisplay(tasks)
  if (ordered.length === 0) return null

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
