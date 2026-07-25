import { useState, type FormEvent } from 'react'
import { weekdayLongEs } from '../../logic/dates'
import {
  BLOCKS_PER_DAY,
  MAX_ESTIMATED_MINUTES,
  blockLabel,
  isValidEstimatedMinutes,
  type FixedTask,
  type FixedTaskDay,
} from '../../logic/planner'
import type { IsoWeekday } from '../../data/types'

interface FixedTaskFormProps {
  initial?: FixedTask
  onSubmit: (values: { text: string; days: FixedTaskDay[] }) => void
  onCancel: () => void
}

const FIELD_CLASS =
  'h-11 w-full rounded-sm border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint focus:border-streak-lime focus:outline-none'

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

/** Estado por día: si toca, a qué hora y cuánto dura. */
interface DayDraft {
  active: boolean
  startBlock: number | null
  minutes: string
}

const EMPTY: DayDraft = { active: false, startBlock: null, minutes: '' }

/**
 * Alta y edición de una tarea fija: un nombre y los días en los que toca, cada
 * uno con su propia hora. Un jueves no es un sábado, así que la hora se elige
 * por día — y puede quedarse vacía, que es lo normal cuando el horario baila.
 */
export function FixedTaskForm({ initial, onSubmit, onCancel }: FixedTaskFormProps) {
  const [text, setText] = useState(initial?.text ?? '')
  const [drafts, setDrafts] = useState<Record<IsoWeekday, DayDraft>>(() => initialDrafts(initial))

  const activeDays = WEEKDAYS.filter((day) => drafts[day].active)
  const minutesValid = activeDays.every((day) => {
    const raw = drafts[day].minutes.trim()
    return raw === '' || isValidEstimatedMinutes(Number(raw))
  })
  const valid = text.trim() !== '' && activeDays.length > 0 && minutesValid

  const patch = (day: IsoWeekday, change: Partial<DayDraft>) => {
    setDrafts((current) => ({ ...current, [day]: { ...current[day], ...change } }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    const days = activeDays.map((day) => {
      const draft = drafts[day]
      const entry: FixedTaskDay = { weekday: day, startBlock: draft.startBlock }
      if (draft.minutes.trim() !== '') entry.estimatedMinutes = Number(draft.minutes)
      return entry
    })
    onSubmit({ text: text.trim(), days })
  }

  return (
    <form onSubmit={submit} className="rounded-sm border border-line p-4">
      <label className="block">
        <span className="font-display text-xs uppercase tracking-widest text-streak-lime">
          Nombre
        </span>
        <input
          autoFocus
          type="text"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          placeholder="Gimnasio"
          className={`mt-1 ${FIELD_CLASS}`}
        />
      </label>

      <p className="mt-4 font-display text-xs uppercase tracking-widest text-ink-soft">
        Días en los que toca
      </p>
      <p className="mt-1 text-sm text-ink-faint">
        Cada día lleva su propia hora, y puede quedarse sin ella.
      </p>

      <ul className="mt-2 divide-y divide-line">
        {WEEKDAYS.map((day) => {
          const draft = drafts[day]
          return (
            <li key={day} className="flex flex-wrap items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => patch(day, { active: !draft.active })}
                aria-pressed={draft.active}
                className={`h-11 w-28 shrink-0 rounded-sm border text-left font-display text-sm uppercase transition-colors ${
                  draft.active
                    ? 'border-streak-lime bg-surface text-streak-lime'
                    : 'border-line text-ink-faint hover:text-ink-soft'
                }`}
              >
                <span className="px-3">{weekdayLongEs(day)}</span>
              </button>

              {draft.active && (
                <>
                  <label className="flex-1">
                    <span className="sr-only">Hora del {weekdayLongEs(day)}</span>
                    <select
                      value={draft.startBlock ?? ''}
                      onChange={(event) =>
                        patch(day, {
                          startBlock:
                            event.currentTarget.value === ''
                              ? null
                              : Number(event.currentTarget.value),
                        })
                      }
                      className={`${FIELD_CLASS} font-display tabular-nums`}
                    >
                      <option value="">Sin hora</option>
                      {Array.from({ length: BLOCKS_PER_DAY }, (_, block) => (
                        <option key={block} value={block}>
                          {blockLabel(block)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-24">
                    <span className="sr-only">Duración del {weekdayLongEs(day)} en minutos</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_ESTIMATED_MINUTES}
                      step={5}
                      value={draft.minutes}
                      onChange={(event) => patch(day, { minutes: event.currentTarget.value })}
                      placeholder="min"
                      className={`${FIELD_CLASS} font-display tabular-nums`}
                    />
                  </label>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {activeDays.length === 0 && (
        <p className="mt-2 text-sm font-semibold text-ink">Elige al menos un día.</p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
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
    </form>
  )
}

function initialDrafts(initial?: FixedTask): Record<IsoWeekday, DayDraft> {
  const drafts = {
    1: { ...EMPTY },
    2: { ...EMPTY },
    3: { ...EMPTY },
    4: { ...EMPTY },
    5: { ...EMPTY },
    6: { ...EMPTY },
    7: { ...EMPTY },
  } satisfies Record<IsoWeekday, DayDraft>
  for (const day of initial?.days ?? []) {
    drafts[day.weekday] = {
      active: true,
      startBlock: day.startBlock,
      minutes: day.estimatedMinutes?.toString() ?? '',
    }
  }
  return drafts
}
