import { toggleTaskDone } from '../../data/repositories/plannerTasksRepo'
import { sortTasksForDisplay } from '../../logic/planner'
import { DraggableTask } from './DropZone'
import { TaskChip } from './TaskChip'
import type { PlannerTask } from '../../data/types'

interface TaskListProps {
  tasks: readonly PlannerTask[]
  editingId: string | null
  onEdit: (id: string) => void
  /**
   * 'row' donde hay ancho (inbox, y los días en móvil); 'grid' en las siete
   * columnas de escritorio, donde una fila cómoda gasta 96 px en asa y casilla
   * y deja el texto en tres caracteres.
   */
  density?: 'row' | 'grid'
  emptyLabel?: string
}

/**
 * Lista de tareas del inbox o de un día. El editor NO se abre aquí dentro: en
 * escritorio una columna es un séptimo de la pantalla y el formulario no cabe,
 * así que vive en una banda a ancho completo de la página.
 */
export function TaskList({
  tasks,
  editingId,
  onEdit,
  density = 'row',
  emptyLabel,
}: TaskListProps) {
  const ordered = sortTasksForDisplay(tasks)

  if (ordered.length === 0) {
    return emptyLabel === undefined ? null : (
      <p className="py-2 text-sm text-ink-faint">{emptyLabel}</p>
    )
  }

  return (
    <ul className={density === 'row' ? 'divide-y divide-line' : 'space-y-1'}>
      {ordered.map((task) => (
        <li
          key={task.id}
          className={`${editingId === task.id ? 'bg-surface' : ''} ${density === 'grid' ? 'h-8' : ''}`}
        >
          <DraggableTask task={task} density={density}>
            {(handle) => (
              <TaskChip
                task={task}
                density={density}
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
