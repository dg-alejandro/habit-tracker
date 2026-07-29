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
import { EmptyState } from '../ui/EmptyState'
import { GripIcon } from '../ui/GripIcon'
import { SkeletonRows } from '../ui/Skeleton'
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET, FIELD_CLASS } from '../ui/classes'

interface TaskBankProps {
  /** `undefined` mientras Dexie responde: vacío y sin cargar no son lo mismo. */
  bank: readonly BankTask[] | undefined
  /** Manda la ficha a la semana sin colocarla: la ruta que no necesita arrastrar. */
  onSend: (item: BankTask) => void
}

/**
 * El banco de tareas reutilizables (§4): lo que se repite semana tras semana.
 * No pertenece a ninguna semana ni recuerda dónde estuvo — se arrastra de aquí
 * a la cuadrícula tantas veces como haga falta, y la ficha se queda.
 *
 * Va plegado por defecto: mientras planificas quieres verlo, pero no ocupa
 * pantalla el resto del tiempo.
 */
export function TaskBank({ bank, onSend }: TaskBankProps) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <section className="mt-8">
      {/* Era la única sección de la app sin encabezado: el rótulo era el propio
          botón. Las clases se quedan en el botón, así que no cambia nada a la
          vista y sí en el árbol de accesibilidad. */}
      <h2>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-14 w-full items-center gap-3 border-b border-streak-lime/60 font-display text-base uppercase tracking-[0.2em] text-streak-lime transition-colors hover:bg-surface"
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span>Banco de tareas</span>
        {/* Sin recuento mientras carga: un «· 0» que luego salta a «· 7» miente. */}
        {bank !== undefined && (
          <span className="tabular-nums text-ink-soft">· {bank.length}</span>
        )}
        <span className="ml-auto text-sm normal-case tracking-normal text-ink-soft">
          {open ? 'arrastra una a la cuadrícula' : 'lo que se repite cada semana'}
        </span>
      </button>
      </h2>

      {open && (
        <div className="mt-3">
          {bank === undefined ? (
            <SkeletonRows rows={2} />
          ) : bank.length === 0 ? (
            <EmptyState>
              Vacío. Añade aquí lo que repites —gimnasio, leer, compra— y arrástralo a la semana
              cuando toque.
            </EmptyState>
          ) : (
            <ul className="flex flex-wrap gap-3">
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
                    <BankChip
                      item={item}
                      onEdit={() => setEditingId(item.id)}
                      onSend={() => onSend(item)}
                    />
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

/**
 * Ficha del banco: se arrastra por el asa, se edita tocando el nombre y el «+»
 * la manda a la semana sin colocar. Ese botón es la red de seguridad de §4: si
 * el gesto de arrastre falla —un ratón torpe, un dedo, el teclado—, la ficha
 * sigue pudiendo bajar a la semana y colocarse luego desde el editor.
 */
function BankChip({
  item,
  onEdit,
  onSend,
}: {
  item: BankTask
  onEdit: () => void
  onSend: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: bankDragId(item.id) })
  const duration = durationLabel(item.estimatedMinutes)

  return (
    <div
      className={`flex items-stretch rounded-sm border border-line border-l-4 border-l-streak-lime bg-surface ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <button
        type="button"
        ref={setNodeRef}
        aria-label={`Arrastrar ${item.text} a la semana`}
        {...attributes}
        {...listeners}
        className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center text-streak-lime active:cursor-grabbing"
      >
        <GripIcon size="sm" />
      </button>
      <button type="button" onClick={onEdit} className="min-h-12 py-2 pr-3 text-left">
        <span className="block text-lg text-ink">{item.text}</span>
        {duration !== null && (
          <span className="block font-display text-sm text-ink-soft">{duration}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onSend}
        aria-label={`Mandar ${item.text} a la semana`}
        title="Mandar a la semana, sin colocar"
        className="flex w-11 shrink-0 items-center justify-center border-l border-line font-display text-xl text-ink-soft transition-colors hover:bg-paper hover:text-streak-lime"
      >
        +
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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
          step={1}
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
            className={BUTTON_PRIMARY}
          >
            Guardar
          </button>
          <button type="button" onClick={onCancel} className={BUTTON_QUIET}>
            Cancelar
          </button>
          {/* En dos pasos, como el resto de borrados de la app: una ficha del
              banco es lo que se repite cada semana, no una tarea de un día. */}
          {confirmingDelete ? (
            <>
              <button
                type="button"
                onClick={onDelete}
                className={BUTTON_DANGER}
              >
                Quitar de verdad
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className={BUTTON_QUIET}
              >
                No
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className={`${BUTTON_QUIET} text-streak-red hover:text-streak-red`}
            >
              Quitar del banco
            </button>
          )}
        </>
      )}
    </form>
  )
}
