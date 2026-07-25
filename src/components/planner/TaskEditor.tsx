import { useState, type FormEvent } from 'react'
import { deleteTask, toggleTaskDone, updateTask } from '../../data/repositories/plannerTasksRepo'
import { weekdayLongEs } from '../../logic/dates'
import {
  BLOCKS_PER_DAY,
  DEFAULT_BLOCK,
  MAX_ESTIMATED_MINUTES,
  blockLabel,
  isValidEstimatedMinutes,
} from '../../logic/planner'
import { CheckToggle } from '../habits/CheckToggle'
import type { IsoWeekday, PlannerTask } from '../../data/types'

interface TaskEditorProps {
  task: PlannerTask
  onClose: () => void
}

const FIELD_CLASS =
  'h-11 w-full rounded-sm border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint focus:border-streak-lime focus:outline-none'

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

/**
 * Edición en línea de la tarea: texto, día, hora, duración y borrado (§4, sin
 * modales). Los selectores de día y hora son además la alternativa SIN arrastre
 * a todo lo que hace el drag & drop.
 */
export function TaskEditor({ task, onClose }: TaskEditorProps) {
  const [text, setText] = useState(task.text)
  const [minutes, setMinutes] = useState(task.estimatedMinutes?.toString() ?? '')
  const [day, setDay] = useState<IsoWeekday | null>(task.day)
  const [startBlock, setStartBlock] = useState<number | null>(task.startBlock)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const parsedMinutes = Number(minutes)
  const minutesValid = minutes.trim() === '' || isValidEstimatedMinutes(parsedMinutes)
  const valid = text.trim() !== '' && minutesValid

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    // Una sola escritura con todo: dos sin esperar se pisarían entre sí.
    void updateTask(task.id, {
      text,
      estimatedMinutes: minutes.trim() === '' ? null : parsedMinutes,
      day,
      startBlock,
    })
    onClose()
  }

  return (
    <form onSubmit={submit} className="rounded-sm border border-line p-4">
      <label className="block">
        <span className="font-display text-sm uppercase tracking-widest text-ink-soft">Tarea</span>
        <input
          autoFocus
          type="text"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          className={`mt-1 ${FIELD_CLASS}`}
        />
      </label>


      <div className="mt-3 flex flex-wrap gap-3">
        <label className="block min-w-32 flex-1">
          <span className="font-display text-sm uppercase tracking-widest text-ink-soft">Día</span>
          <select
            value={day ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value
              setDay(value === '' ? null : (Number(value) as IsoWeekday))
              // Sin día no hay hora, y con día siempre hay una: colocar es
              // ocupar un hueco, y sin hora la tarea no se vería en ningún sitio.
              if (value === '') setStartBlock(null)
              else if (startBlock === null) setStartBlock(DEFAULT_BLOCK)
            }}
            className={`mt-1 ${FIELD_CLASS} capitalize`}
          >
            <option value="">Sin colocar</option>
            {WEEKDAYS.map((weekday) => (
              <option key={weekday} value={weekday}>
                {weekdayLongEs(weekday)}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-32 flex-1">
          <span className="font-display text-sm uppercase tracking-widest text-ink-soft">Hora</span>
          <select
            value={startBlock ?? ''}
            disabled={day === null}
            onChange={(event) =>
              setStartBlock(
                event.currentTarget.value === '' ? null : Number(event.currentTarget.value),
              )
            }
            className={`mt-1 ${FIELD_CLASS} font-display tabular-nums disabled:text-ink-faint`}
          >
            {/* Deshabilitada a propósito: elegir «sin hora» con un día puesto
                dejaba la tarea sin sitio donde verse. Para quitarla de la
                cuadrícula está «Sin colocar» en el selector de al lado. */}
            <option value="" disabled>
              —
            </option>
            {Array.from({ length: BLOCKS_PER_DAY }, (_, block) => (
              <option key={block} value={block}>
                {blockLabel(block)}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-32 flex-1">
          <span className="font-display text-sm uppercase tracking-widest text-ink-soft">
            Duración (min)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_ESTIMATED_MINUTES}
            step={1}
            value={minutes}
            onChange={(event) => setMinutes(event.currentTarget.value)}
            placeholder="Sin estimar"
            className={`mt-1 ${FIELD_CLASS} font-display tabular-nums`}
          />
        </label>
      </div>

      {/* Completar desde aquí también: en la cuadrícula el chip de un bloque
          mide 26 px y no es objetivo táctil para el pulgar de noche. */}
      <button
        type="button"
        onClick={() => void toggleTaskDone(task.id)}
        aria-pressed={task.done}
        className="mt-3 flex h-11 w-full items-center gap-3 rounded-sm border border-line px-3 text-sm text-ink transition-colors hover:bg-surface"
      >
        <CheckToggle checked={task.done} />
        <span>{task.done ? 'Completada' : 'Marcar como completada'}</span>
      </button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void deleteTask(task.id)
                onClose()
              }}
              className="h-11 rounded-sm border border-streak-red px-4 text-sm font-semibold text-streak-red transition-colors hover:bg-surface"
            >
              Eliminar de verdad
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-11 rounded-sm px-3 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="h-11 rounded-sm px-3 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
          >
            Eliminar
          </button>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-sm px-4 text-sm font-medium text-ink-soft transition-colors hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="h-11 rounded-sm bg-ink px-5 text-sm font-semibold text-paper transition-opacity disabled:opacity-30"
          >
            Guardar
          </button>
        </div>
      </div>
    </form>
  )
}
