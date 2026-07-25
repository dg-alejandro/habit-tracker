import { createTask } from '../../data/repositories/plannerTasksRepo'
import { QuickAddField } from './QuickAddField'
import { TaskList } from './TaskList'
import type { PlannerTask, WeekId } from '../../data/types'

interface WeekInboxProps {
  weekId: WeekId
  tasks: readonly PlannerTask[]
  editingId: string | null
  onEdit: (id: string) => void
}

/**
 * Inbox semanal (§4): las tareas de la semana sin día asignado. Es donde se
 * vuelcan las ideas antes de colocarlas, y donde aterrizan las arrastradas
 * desde la semana anterior.
 */
export function WeekInbox({ weekId, tasks, editingId, onEdit }: WeekInboxProps) {
  const pending = tasks.filter((task) => !task.done).length

  return (
    <section className="mt-6">
      <h2 className="text-xs font-medium uppercase tracking-widest text-ink-soft">
        Inbox {pending > 0 && <span className="text-ink">· {pending}</span>}
      </h2>
      <div className="mt-2">
        <QuickAddField
          placeholder="Añadir al inbox y Enter"
          onSubmit={(text) => void createTask({ text, weekId })}
        />
      </div>
      <div className="mt-1">
        <TaskList
          tasks={tasks}
          editingId={editingId}
          onEdit={onEdit}
          emptyLabel="Nada suelto esta semana."
        />
      </div>
    </section>
  )
}
