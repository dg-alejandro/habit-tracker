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
 * La caja donde se escribe, y el único sitio de la pantalla donde se crea nada.
 * Toda tarea nace aquí —sin día ni hora— y de aquí se arrastra a un hueco de la
 * cuadrícula. Al crearla se elige si es persistente (vuelve sola cada semana) o
 * puntual, y se le puede dar duración.
 *
 * Es también zona de soltado, así que arrastrar una tarea de vuelta la descoloca
 * sin borrarla.
 */
export function UnplacedTray({ weekId, tasks, editingId, onEdit }: UnplacedTrayProps) {
  const [text, setText] = useState('')
  const [persistent, setPersistent] = useState(false)
  const [minutes, setMinutes] = useState('')

  const parsedMinutes = Number(minutes)
  const minutesValid = minutes.trim() === '' || isValidEstimatedMinutes(parsedMinutes)
  const canSubmit = text.trim() !== '' && minutesValid

  const commit = () => {
    if (!canSubmit) return
    const input = { text: text.trim(), weekId, persistent }
    void createTask(minutes.trim() === '' ? input : { ...input, estimatedMinutes: parsedMinutes })
    setText('')
    // El tipo y la duración se conservan: se suelen crear varias seguidas iguales.
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
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line pb-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">
          Sin colocar {pending > 0 && <span className="text-streak-orange">· {pending}</span>}
        </h2>
        <p className="font-display text-xs text-ink-faint">
          escribe aquí y arrastra al hueco que quieras
        </p>
      </div>

      <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2">
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
            step={5}
            value={minutes}
            onChange={(event) => setMinutes(event.currentTarget.value)}
            onKeyDown={keyDown}
            placeholder="min"
            className={`w-20 ${FIELD_CLASS} font-display tabular-nums`}
          />
        </label>

        {/* Dos botones y no un desplegable: se ve de un vistazo cuál está
            armado, y es lo que decide si la tarea vuelve la semana que viene. */}
        <div className="flex" role="group" aria-label="Clase de tarea">
          {(
            [
              { value: false, label: 'Puntual' },
              { value: true, label: 'Persistente' },
            ] as const
          ).map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setPersistent(option.value)}
              aria-pressed={persistent === option.value}
              className={`h-11 border px-3 font-display text-xs uppercase tracking-widest transition-colors first:rounded-l-sm last:rounded-r-sm ${
                persistent === option.value
                  ? 'border-streak-lime bg-surface text-streak-lime'
                  : 'border-line text-ink-faint hover:text-ink-soft'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </form>

      <p className="mt-1 font-display text-xs text-ink-faint">
        {persistent
          ? 'Persistente: volverá sola cada semana, en el hueco donde la dejes.'
          : 'Puntual: si acaba la semana sin hacerse, desaparece.'}
      </p>

      <DropZone target={{ kind: 'unplaced' }} className="mt-2 min-h-14 rounded-sm">
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
