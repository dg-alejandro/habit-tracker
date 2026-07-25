import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { createTask } from '../../data/repositories/plannerTasksRepo'
import { MAX_ESTIMATED_MINUTES, isValidEstimatedMinutes } from '../../logic/planner'
import { DropZone } from './DropZone'
import { TaskList } from './TaskList'
import type { PlannerTask, WeekId } from '../../data/types'

interface UnplacedTrayProps {
  weekId: WeekId
  /** Las tareas de la semana que aún no están colocadas. */
  tasks: readonly PlannerTask[]
  editingId: string | null
  onEdit: (id: string) => void
}

const FIELD_CLASS =
  'h-11 rounded-sm border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint focus:border-streak-lime focus:outline-none'

/**
 * Las tareas PUNTUALES de la semana que aún no están colocadas, y el campo para
 * escribirlas. Lo que se repite no vive aquí: eso está en el banco.
 *
 * Es también zona de soltado, así que arrastrar una tarea de vuelta la descoloca
 * sin borrarla.
 */
export function UnplacedTray({ weekId, tasks, editingId, onEdit }: UnplacedTrayProps) {
  const [text, setText] = useState('')
  const [minutes, setMinutes] = useState('')

  const parsedMinutes = Number(minutes)
  const minutesValid = minutes.trim() === '' || isValidEstimatedMinutes(parsedMinutes)
  const canSubmit = text.trim() !== '' && minutesValid

  const commit = () => {
    if (!canSubmit) return
    const input = { text: text.trim(), weekId }
    void createTask(minutes.trim() === '' ? input : { ...input, estimatedMinutes: parsedMinutes })
    setText('')
    // La duración se conserva: se suelen crear varias seguidas parecidas.
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    commit()
  }

  // El Enter se atiende a mano además del submit: el envío implícito de un
  // formulario sin botón no es fiable, y en iOS menos aún.
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit()
  }

  const pending = tasks.filter((task) => !task.done).length

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line pb-2">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-streak-lime">
          Sueltas de esta semana{' '}
          {pending > 0 && <span className="tabular-nums text-streak-orange">· {pending}</span>}
        </h2>
        <p className="font-display text-xs text-ink-faint">
          desaparecen al acabar la semana
        </p>
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={keyDown}
          placeholder="Escribe una tarea y Enter"
          aria-label="Escribir una tarea nueva"
          enterKeyHint="done"
          autoCapitalize="sentences"
          className={`min-w-48 flex-1 ${FIELD_CLASS}`}
        />

        <label className="flex items-center">
          <span className="sr-only">Duración en minutos</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_ESTIMATED_MINUTES}
            step={1}
            value={minutes}
            onChange={(event) => setMinutes(event.currentTarget.value)}
            onKeyDown={keyDown}
            placeholder="min"
            className={`w-20 ${FIELD_CLASS} font-display tabular-nums`}
          />
        </label>

      </form>


      <DropZone target={{ kind: 'unplaced' }} className="mt-2 min-h-14 rounded-sm">
        {tasks.length === 0 ? (
          <p className="py-4 text-base text-ink-faint">
            Nada suelto. Lo que escribas aquí aparecerá hasta que lo arrastres a un hueco.
          </p>
        ) : (
          <TaskList tasks={tasks} editingId={editingId} onEdit={onEdit} />
        )}
      </DropZone>
    </section>
  )
}
