import type { ReactNode } from 'react'
import { CheckToggle } from '../habits/CheckToggle'
import { blockRangeLabel, carryLabel, carryLevel, durationLabel } from '../../logic/planner'
import type { PlannerTask } from '../../data/types'

interface TaskChipProps {
  task: PlannerTask
  /**
   * 'row' donde hay ancho de sobra (inbox, y las listas de día en móvil);
   * 'grid' donde no lo hay: dentro de la cuadrícula y en las siete columnas de
   * escritorio, donde una fila cómoda dejaría el texto en tres caracteres.
   */
  density: 'row' | 'grid'
  onToggle: () => void
  onOpen: () => void
  /** Asa de arrastre; solo la pone la envoltura arrastrable en densidad 'row'. */
  handle?: ReactNode
}

/**
 * La tarea, vista. Monocroma salvo una excepción escrita en §4: a partir de la
 * tercera semana arrastrada se marca en rojo — o se hace, o se borra. El rojo
 * se reduce a un filete y a la insignia; el texto sigue en blanco.
 * La completada se queda visible, tachada y atenuada (§4).
 */
export function TaskChip({ task, density, onToggle, onOpen, handle }: TaskChipProps) {
  const level = carryLevel(task.carriedOverCount)
  const carry = carryLabel(task.carriedOverCount)
  const alarm = level === 'alarm'
  const time = blockRangeLabel(task.startBlock, task.estimatedMinutes)
  const duration = durationLabel(task.estimatedMinutes)

  if (density === 'grid') {
    return (
      <div
        className={`flex h-full w-full overflow-hidden rounded-md border border-line bg-surface ${
          alarm ? 'border-l-2 border-l-streak-red' : ''
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={task.done}
          aria-label={`Completar ${task.text}`}
          className="flex w-6 shrink-0 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded-sm border ${
              task.done ? 'border-ink bg-ink' : 'border-ink-faint'
            }`}
          />
        </button>
        <button
          type="button"
          onClick={onOpen}
          title={task.text}
          className="min-w-0 flex-1 py-0.5 pr-1 text-left"
        >
          <span
            className={`block truncate text-xs leading-tight ${
              task.done ? 'text-ink-faint line-through' : 'text-ink'
            }`}
          >
            {task.text}
          </span>
          {time !== null && <span className="block truncate text-[10px] text-ink-faint">{time}</span>}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex min-h-14 items-center gap-1 py-2 ${
        alarm ? 'border-l-2 border-l-streak-red pl-2' : ''
      }`}
    >
      {handle}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={task.done}
        aria-label={`Completar ${task.text}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <CheckToggle checked={task.done} />
      </button>
      {/* self-stretch: la fila mide 56 px y el objetivo táctil debe medir lo mismo. */}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 self-stretch py-1 text-left">
        <span
          className={`block truncate text-base ${
            task.done ? 'text-ink-faint line-through' : 'text-ink'
          }`}
        >
          {task.text}
        </span>
        {(time !== null || duration !== null || carry !== null) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            {time !== null && <span className="text-ink-soft">{time}</span>}
            {time === null && duration !== null && <span className="text-ink-soft">{duration}</span>}
            {carry !== null && (
              <span className={alarm ? 'font-semibold text-streak-red' : 'text-ink-soft'}>
                {carry}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  )
}
