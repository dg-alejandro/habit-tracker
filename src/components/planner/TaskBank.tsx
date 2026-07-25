import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import {
  createBankTask,
  deleteBankTask,
  updateBankTask,
} from '../../data/repositories/taskBankRepo'
import {
  MAX_ESTIMATED_MINUTES,
  bankDragId,
  durationLabel,
  isValidEstimatedMinutes,
  type BankTask,
} from '../../logic/planner'

interface TaskBankProps {
  bank: readonly BankTask[]
}

const FIELD_CLASS =
  'h-11 rounded-sm border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint focus:border-streak-magenta focus:outline-none'

/**
 * El banco de tareas reutilizables (§4): lo que se repite semana tras semana.
 * No pertenece a ninguna semana ni recuerda dónde estuvo — se arrastra de aquí
 * a la cuadrícula tantas veces como haga falta, y la ficha se queda.
 *
 * Va plegado por defecto: mientras planificas quieres verlo, pero no ocupa
 * pantalla el resto del tiempo.
 */
export function TaskBank({ bank }: TaskBankProps) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-11 w-full items-center gap-2 border-b border-streak-magenta/60 font-display text-xs uppercase tracking-widest text-streak-magenta transition-colors hover:bg-surface"
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span>Banco de tareas</span>
        <span className="tabular-nums text-ink-faint">· {bank.length}</span>
        <span className="ml-auto normal-case tracking-normal text-ink-faint">
          {open ? 'arrastra una a la cuadrícula' : 'lo que se repite cada semana'}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          {bank.length === 0 ? (
            <p className="text-sm text-ink-faint">
              Vacío. Añade aquí lo que repites —gimnasio, leer, compra— y arrástralo a la semana
              cuando toque.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {bank.map((item) =>
                editingId === item.id ? (
                  <li key={item.id} className="w-full">
                    <BankTaskForm
                      initial={item}
                      onSubmit={(values) => {
                        void updateBankTask(item.id, values)
                        setEditingId(null)
                      }}
                      onCancel={() => setEditingId(null)}
                      onDelete={() => {
                        void deleteBankTask(item.id)
                        setEditingId(null)
                      }}
                    />
                  </li>
                ) : (
                  <li key={item.id}>
                    <BankChip item={item} onEdit={() => setEditingId(item.id)} />
                  </li>
                ),
              )}
            </ul>
          )}

          <div className="mt-3">
            <BankTaskForm onSubmit={(values) => void createBankTask(values)} />
          </div>
        </div>
      )}
    </section>
  )
}

/** Ficha del banco: se arrastra por el asa y se edita tocando el nombre. */
function BankChip({ item, onEdit }: { item: BankTask; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: bankDragId(item.id) })
  const duration = durationLabel(item.estimatedMinutes)

  return (
    <div
      className={`flex items-stretch rounded-sm border border-streak-magenta/60 bg-surface ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <button
        type="button"
        ref={setNodeRef}
        aria-label={`Arrastrar ${item.text} a la semana`}
        {...attributes}
        {...listeners}
        className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center text-streak-magenta active:cursor-grabbing"
      >
        <GripIcon />
      </button>
      <button type="button" onClick={onEdit} className="min-h-11 py-1 pr-3 text-left">
        <span className="block text-sm text-ink">{item.text}</span>
        {duration !== null && (
          <span className="block font-display text-xs text-ink-faint">{duration}</span>
        )}
      </button>
    </div>
  )
}

interface BankTaskFormProps {
  initial?: BankTask
  onSubmit: (values: { text: string; estimatedMinutes?: number }) => void
  onCancel?: () => void
  onDelete?: () => void
}

/** Alta y edición de una ficha del banco: nombre y, si acaso, cuánto dura. */
function BankTaskForm({ initial, onSubmit, onCancel, onDelete }: BankTaskFormProps) {
  const [text, setText] = useState(initial?.text ?? '')
  const [minutes, setMinutes] = useState(initial?.estimatedMinutes?.toString() ?? '')

  const parsed = Number(minutes)
  const minutesValid = minutes.trim() === '' || isValidEstimatedMinutes(parsed)
  const valid = text.trim() !== '' && minutesValid

  const commit = () => {
    if (!valid) return
    const base = { text: text.trim() }
    onSubmit(minutes.trim() === '' ? base : { ...base, estimatedMinutes: parsed })
    if (initial === undefined) {
      setText('')
      setMinutes('')
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    commit()
  }

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit()
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        onKeyDown={keyDown}
        placeholder={initial === undefined ? 'Añadir al banco y Enter' : 'Nombre'}
        aria-label={initial === undefined ? 'Añadir una tarea al banco' : 'Nombre de la tarea'}
        autoFocus={initial !== undefined}
        className={`min-w-40 flex-1 ${FIELD_CLASS}`}
      />
      <label>
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
      {initial !== undefined && (
        <>
          <button
            type="submit"
            disabled={!valid}
            className="h-11 rounded-sm bg-ink px-4 font-display text-xs uppercase tracking-widest text-paper disabled:opacity-30"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-sm px-3 font-display text-xs uppercase tracking-widest text-ink-soft hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="h-11 rounded-sm px-3 font-display text-xs uppercase tracking-widest text-streak-red hover:bg-surface"
          >
            Quitar del banco
          </button>
        </>
      )}
    </form>
  )
}

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <circle cx="7" cy="5" r="1.5" />
      <circle cx="13" cy="5" r="1.5" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <circle cx="7" cy="15" r="1.5" />
      <circle cx="13" cy="15" r="1.5" />
    </svg>
  )
}
