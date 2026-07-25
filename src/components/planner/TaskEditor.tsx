import { useState, type FormEvent } from 'react'
import { deleteTask, updateTask } from '../../data/repositories/plannerTasksRepo'
import { weekdayLongEs } from '../../logic/dates'
import { BLOCKS_PER_DAY, blockLabel } from '../../logic/planner'
import type { IsoWeekday, PlannerTask } from '../../data/types'

interface TaskEditorProps {
  task: PlannerTask
  onClose: () => void
}

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint'

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

/**
 * Edición en línea de la tarea: texto, duración, día, hora y borrado (§4, sin
 * modales). Los selectores de día y hora son además la alternativa SIN arrastre
 * a todo lo que hace el drag & drop: si el gesto falla en el iPhone, planificar
 * la semana entera desde el móvil sigue siendo posible.
 */
export function TaskEditor({ task, onClose }: TaskEditorProps) {
  const [text, setText] = useState(task.text)
  const [minutes, setMinutes] = useState(task.estimatedMinutes?.toString() ?? '')
  const [day, setDay] = useState<IsoWeekday | null>(task.day)
  const [startBlock, setStartBlock] = useState<number | null>(task.startBlock)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const parsedMinutes = Number(minutes)
  const minutesValid =
    minutes.trim() === '' || (Number.isFinite(parsedMinutes) && parsedMinutes > 0)
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

  const changeDay = (next: IsoWeekday | null) => {
    setDay(next)
    // Sin día no puede haber hora: la tarea vuelve al inbox entera.
    if (next === null) setStartBlock(null)
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line p-4">
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Tarea</span>
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
          <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Día</span>
          <select
            value={day ?? ''}
            onChange={(event) =>
              changeDay(event.currentTarget.value === '' ? null : (Number(event.currentTarget.value) as IsoWeekday))
            }
            className={`mt-1 ${FIELD_CLASS} capitalize`}
          >
            <option value="">Inbox</option>
            {WEEKDAYS.map((weekday) => (
              <option key={weekday} value={weekday}>
                {weekdayLongEs(weekday)}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-32 flex-1">
          <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Hora</span>
          <select
            value={startBlock ?? ''}
            disabled={day === null}
            onChange={(event) =>
              setStartBlock(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))
            }
            className={`mt-1 ${FIELD_CLASS} tabular-nums disabled:text-ink-faint`}
          >
            <option value="">Sin hora</option>
            {Array.from({ length: BLOCKS_PER_DAY }, (_, block) => (
              <option key={block} value={block}>
                {blockLabel(block)}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-32 flex-1">
          <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">
            Duración (min)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={5}
            value={minutes}
            onChange={(event) => setMinutes(event.currentTarget.value)}
            placeholder="Sin estimar"
            className={`mt-1 ${FIELD_CLASS} tabular-nums`}
          />
        </label>
      </div>

      {day === null && startBlock === null && (
        <p className="mt-2 text-xs text-ink-faint">
          Una tarea del inbox no tiene hora: asígnale un día para poder colocarla.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void deleteTask(task.id)
                onClose()
              }}
              className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface"
            >
              Eliminar de verdad
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-11 rounded-lg px-3 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="h-11 rounded-lg px-3 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
          >
            Eliminar
          </button>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg px-4 text-sm font-medium text-ink-soft transition-colors hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-paper transition-opacity disabled:opacity-30"
          >
            Guardar
          </button>
        </div>
      </div>
    </form>
  )
}
