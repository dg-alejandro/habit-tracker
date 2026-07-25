import { createTask } from '../../data/repositories/plannerTasksRepo'
import { DropZone } from './DropZone'
import { QuickAddField } from './QuickAddField'
import { TaskList } from './TaskList'
import type { PlannerTask, WeekId } from '../../data/types'

interface UnplacedTrayProps {
  weekId: WeekId
  /** Las tareas de la semana que aún no tienen día. */
  tasks: readonly PlannerTask[]
  editingId: string | null
  onEdit: (id: string) => void
}

/**
 * La caja donde se escribe. Toda tarea nace aquí, sin día ni hora, y de aquí se
 * arrastra al día o al bloque horario que toque (§4). Colocarla no es
 * obligatorio: puede quedarse suelta toda la semana.
 *
 * Es también zona de soltado, así que arrastrar una tarea de vuelta la
 * descoloca sin borrarla.
 */
export function UnplacedTray({ weekId, tasks, editingId, onEdit }: UnplacedTrayProps) {
  const pending = tasks.filter((task) => !task.done).length

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line pb-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">
          Sin colocar {pending > 0 && <span className="text-streak-orange">· {pending}</span>}
        </h2>
        <p className="font-display text-xs text-ink-faint">
          escribe aquí y arrastra al día o a la hora
        </p>
      </div>

      <div className="mt-2">
        <QuickAddField
          placeholder="Escribe una tarea y Enter"
          label="Escribir una tarea nueva"
          onSubmit={(text) => void createTask({ text, weekId })}
        />
      </div>

      <DropZone target={{ kind: 'unplaced' }} className="mt-1 min-h-14 rounded-sm">
        {tasks.length === 0 ? (
          <p className="py-3 text-sm text-ink-faint">
            Nada suelto. Lo que escribas aparecerá aquí hasta que lo coloques.
          </p>
        ) : (
          <TaskList tasks={tasks} editingId={editingId} onEdit={onEdit} />
        )}
      </DropZone>
    </section>
  )
}
