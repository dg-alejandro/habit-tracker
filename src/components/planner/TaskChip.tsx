import type { ReactNode } from 'react'
import { CheckToggle } from '../habits/CheckToggle'
import { blockRangeLabel, durationLabel } from '../../logic/planner'
import type { PlannerTask } from '../../data/types'

interface TaskChipProps {
  task: PlannerTask
  /**
   * 'row' donde hay ancho (los días en móvil); 'grid' donde no lo hay: dentro
   * de la cuadrícula y en las siete columnas de escritorio.
   */
  density: 'row' | 'grid'
  onToggle: () => void
  onOpen: () => void
  /** Asa de arrastre; solo la pone la envoltura arrastrable en densidad 'row'. */
  handle?: ReactNode
}

/**
 * La tarea, vista. Las FIJAS llevan un filete lima a la izquierda: son el
 * esqueleto de la semana y se distinguen de un vistazo de las breves, que solo
 * viven esta semana. La completada se queda visible, tachada y atenuada (§4).
 */
export function TaskChip({ task, density, onToggle, onOpen, handle }: TaskChipProps) {
  const fixed = task.templateId !== null
  const time = blockRangeLabel(task.startBlock, task.estimatedMinutes)
  const duration = durationLabel(task.estimatedMinutes)

  if (density === 'grid') {
    return (
      <div
        className={`flex h-full w-full overflow-hidden rounded-sm border border-line bg-surface ${
          fixed ? 'border-l-2 border-l-streak-lime' : ''
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
            className={`h-3 w-3 border ${
              task.done ? 'border-streak-lime bg-streak-lime' : 'border-ink-faint'
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
            className={`block truncate font-display text-xs leading-tight ${
              task.done ? 'text-ink-faint line-through' : 'text-ink'
            }`}
          >
            {task.text}
          </span>
          {time !== null && (
            <span className="block truncate font-display text-[10px] text-ink-faint">{time}</span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex min-h-14 items-center gap-1 py-2 ${
        fixed ? 'border-l-2 border-l-streak-lime pl-2' : ''
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
        {(time !== null || duration !== null) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-display text-xs text-ink-soft">
            {time !== null && <span>{time}</span>}
            {time === null && duration !== null && <span>{duration}</span>}
          </span>
        )}
      </button>
    </div>
  )
}
