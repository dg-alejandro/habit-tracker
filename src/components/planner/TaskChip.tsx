import type { ReactNode } from 'react'
import { CheckToggle } from '../habits/CheckToggle'
import { blockRangeLabel, durationLabel, isFromBank } from '../../logic/planner'
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
 * La tarea, vista. El color dice de dónde salió: lima si vino del banco —lo
 * que se repite—, naranja si es una tarea suelta de esta semana. Con una
 * cuadrícula llena, el color es lo que deja leerla de un vistazo.
 * La completada se queda visible, tachada y atenuada (§4).
 */
export function TaskChip({ task, density, onToggle, onOpen, handle }: TaskChipProps) {
  const fromBank = isFromBank(task)
  // Tailwind no ve nombres de clase construidos por interpolación: enteros.
  const doneBox = fromBank
    ? 'border-streak-lime bg-streak-lime'
    : 'border-streak-orange bg-streak-orange'
  const time = blockRangeLabel(task.startBlock, task.estimatedMinutes)
  const duration = durationLabel(task.estimatedMinutes)

  if (density === 'grid') {
    return (
      <div
        className={`flex h-full w-full overflow-hidden rounded-sm border border-line border-l-4 bg-surface ${
          fromBank ? 'border-l-streak-lime' : 'border-l-streak-orange'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={task.done}
          aria-label={`Completar ${task.text}`}
          className="flex w-7 shrink-0 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={`h-3.5 w-3.5 border ${task.done ? doneBox : 'border-ink-faint'}`}
          />
        </button>
        <button
          type="button"
          onClick={onOpen}
          title={task.text}
          className="min-w-0 flex-1 py-1 pr-1.5 text-left"
        >
          <span
            className={`block truncate text-sm leading-tight ${
              task.done ? 'text-ink-faint line-through' : 'text-ink'
            }`}
          >
            {task.text}
          </span>
          {time !== null && (
            <span className="block truncate font-display text-xs text-ink-faint">{time}</span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex min-h-14 items-center gap-1 border-l-4 py-2 pl-2 ${
        fromBank ? 'border-l-streak-lime' : 'border-l-streak-orange'
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
          className={`block truncate text-lg ${
            task.done ? 'text-ink-faint line-through' : 'text-ink'
          }`}
        >
          {task.text}
        </span>
        {(time !== null || duration !== null) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 font-display text-sm text-ink-soft">
            {time !== null && <span>{time}</span>}
            {time === null && duration !== null && <span>{duration}</span>}
          </span>
        )}
      </button>
    </div>
  )
}
