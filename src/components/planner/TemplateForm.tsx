import { useState, type FormEvent } from 'react'
import { weekdayLongEs } from '../../logic/dates'
import {
  BLOCKS_PER_DAY,
  MAX_ESTIMATED_MINUTES,
  blockLabel,
  isValidEstimatedMinutes,
} from '../../logic/planner'
import type { IsoWeekday, TaskTemplate } from '../../data/types'

export interface TemplateFormValues {
  text: string
  weekday: IsoWeekday
  startBlock: number | null
  estimatedMinutes?: number
}

interface TemplateFormProps {
  initial?: TaskTemplate
  onSubmit: (values: TemplateFormValues) => void
  onCancel: () => void
}

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint'

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

/** Alta y edición en línea de una plantilla de tarea fija (§4). Sin modales. */
export function TemplateForm({ initial, onSubmit, onCancel }: TemplateFormProps) {
  const [text, setText] = useState(initial?.text ?? '')
  const [weekday, setWeekday] = useState<IsoWeekday>(initial?.weekday ?? 1)
  const [startBlock, setStartBlock] = useState<number | null>(initial?.startBlock ?? null)
  const [minutes, setMinutes] = useState(initial?.estimatedMinutes?.toString() ?? '')

  const parsedMinutes = Number(minutes)
  const minutesValid = minutes.trim() === '' || isValidEstimatedMinutes(parsedMinutes)
  const valid = text.trim() !== '' && minutesValid

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    const values: TemplateFormValues = { text: text.trim(), weekday, startBlock }
    if (minutes.trim() !== '') values.estimatedMinutes = parsedMinutes
    onSubmit(values)
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
          placeholder="Nombre de la tarea fija"
          className={`mt-1 ${FIELD_CLASS}`}
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-3">
        <label className="block min-w-32 flex-1">
          <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Día</span>
          <select
            value={weekday}
            onChange={(event) => setWeekday(Number(event.currentTarget.value) as IsoWeekday)}
            className={`mt-1 ${FIELD_CLASS} capitalize`}
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {weekdayLongEs(day)}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-32 flex-1">
          <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Hora</span>
          <select
            value={startBlock ?? ''}
            onChange={(event) =>
              setStartBlock(
                event.currentTarget.value === '' ? null : Number(event.currentTarget.value),
              )
            }
            className={`mt-1 ${FIELD_CLASS} tabular-nums`}
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
            max={MAX_ESTIMATED_MINUTES}
            step={5}
            value={minutes}
            onChange={(event) => setMinutes(event.currentTarget.value)}
            placeholder="Sin estimar"
            className={`mt-1 ${FIELD_CLASS} tabular-nums`}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
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
    </form>
  )
}
