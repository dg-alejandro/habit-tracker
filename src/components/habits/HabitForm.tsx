import { useState, type FormEvent } from 'react'
import { DEFAULT_WEEKLY_TARGET, type Habit, type HabitType } from '../../data/types'

export interface HabitFormValues {
  name: string
  type: HabitType
  targetMinutes?: number
  weeklyTarget: number
}

interface HabitFormProps {
  /** Si viene, es edición: el tipo queda bloqueado (inmutable tras la creación). */
  initial?: Habit
  onSubmit: (values: HabitFormValues) => void
  onCancel: () => void
}

const TYPE_LABELS: Record<HabitType, string> = {
  check: 'Casilla (sí/no)',
  counter: 'Contador con objetivo',
  counter_note: 'Contador con nota',
}

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint'

/** Formulario en línea de crear/editar hábito. Sin modales. */
export function HabitForm({ initial, onSubmit, onCancel }: HabitFormProps) {
  const editing = initial !== undefined
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<HabitType>(initial?.type ?? 'check')
  const [targetMinutes, setTargetMinutes] = useState(String(initial?.targetMinutes ?? 30))
  const [weeklyTarget, setWeeklyTarget] = useState(String(initial?.weeklyTarget ?? DEFAULT_WEEKLY_TARGET))

  const isCounter = type !== 'check'
  const parsedTarget = Number(targetMinutes)
  const parsedWeekly = Number(weeklyTarget)
  const valid =
    name.trim() !== '' &&
    (!isCounter || (Number.isFinite(parsedTarget) && parsedTarget > 0)) &&
    Number.isInteger(parsedWeekly) &&
    parsedWeekly >= 1 &&
    parsedWeekly <= 7

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    const values: HabitFormValues = { name: name.trim(), type, weeklyTarget: parsedWeekly }
    if (isCounter) values.targetMinutes = parsedTarget
    onSubmit(values)
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line p-4">
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Nombre</span>
        <input
          autoFocus={!editing}
          type="text"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="Nombre del hábito"
          className={`mt-1 ${FIELD_CLASS}`}
        />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Tipo</span>
        <select
          value={type}
          disabled={editing}
          onChange={(event) => setType(event.currentTarget.value as HabitType)}
          className={`mt-1 ${FIELD_CLASS} disabled:text-ink-faint`}
        >
          {(Object.keys(TYPE_LABELS) as HabitType[]).map((key) => (
            <option key={key} value={key}>
              {TYPE_LABELS[key]}
            </option>
          ))}
        </select>
        {editing && <span className="mt-1 block text-xs text-ink-faint">El tipo no se puede cambiar.</span>}
      </label>

      <div className="mt-3 flex gap-3">
        {isCounter && (
          <label className="block flex-1">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Objetivo (min)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={targetMinutes}
              onChange={(event) => setTargetMinutes(event.currentTarget.value)}
              className={`mt-1 ${FIELD_CLASS} tabular-nums`}
            />
          </label>
        )}
        <label className="block flex-1">
          <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Objetivo semanal</span>
          <select
            value={weeklyTarget}
            onChange={(event) => setWeeklyTarget(event.currentTarget.value)}
            className={`mt-1 ${FIELD_CLASS}`}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((days) => (
              <option key={days} value={days}>
                {days} de 7 días
              </option>
            ))}
          </select>
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
