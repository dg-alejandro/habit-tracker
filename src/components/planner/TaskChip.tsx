import type { ReactNode } from 'react'
import { CheckToggle } from '../ui/CheckToggle'
import {
  blockRangeLabel,
  durationLabel,
  isFromBank,
  shortDurationLabel,
} from '../../logic/planner'
import type { PlannerTask } from '../../data/types'

interface TaskChipProps {
  task: PlannerTask
  /** 'row' en las listas; 'grid' dentro de la cuadrícula. */
  density: 'row' | 'grid'
  /**
   * Solo en la cuadrícula: el chip comparte la columna con otros porque se
   * solapan. Con la columna partida no cabe la casilla, y el nombre manda.
   */
  shared?: boolean
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
export function TaskChip({ task, density, shared, onToggle, onOpen, handle }: TaskChipProps) {
  const fromBank = isFromBank(task)
  // Tailwind no ve nombres de clase construidos por interpolación: enteros.
  const doneBox = fromBank
    ? 'border-streak-lime bg-streak-lime'
    : 'border-streak-orange bg-streak-orange'
  const time = blockRangeLabel(task.startBlock, task.estimatedMinutes)
  const duration = durationLabel(task.estimatedMinutes)
  const hint = time === null ? task.text : `${task.text} · ${time}`

  if (density === 'grid') {
    return (
      <div
        className={`flex h-full w-full overflow-hidden rounded-sm border border-line border-l-4 bg-surface ${
          fromBank ? 'border-l-streak-lime' : 'border-l-streak-orange'
        }`}
      >
        {/* Con la columna partida entre varias tareas el chip baja de 90 px, y
            40 de casilla dejarían el nombre en dos letras. Ahí desaparece: la
            tarea se completa desde el editor, que tiene su botón a ancho
            completo. Lo que no se puede leer no sirve de nada. */}
        {shared !== true && (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={task.done}
            aria-label={`Completar ${task.text}`}
            className="flex w-10 shrink-0 items-center justify-center"
          >
            <span
              aria-hidden="true"
              className={`h-4 w-4 border-2 ${task.done ? doneBox : 'border-ink-faint'}`}
            />
          </button>
        )}
        <button
          type="button"
          onClick={onOpen}
          title={hint}
          className={`flex min-w-0 flex-1 flex-col justify-center overflow-hidden py-1 pr-2 text-left ${
            shared === true ? 'pl-2' : ''
          }`}
        >
          {/* Con siete columnas el nombre no cabe en una línea: se parte antes
              de recortar. Debajo va la DURACIÓN, no el rango horario — la hora de
              inicio ya la dice la fila en la que está el chip, y gastar una línea
              en repetirla era lo que dejaba el nombre en tres letras.

              Compartiendo columna quedan ~66 px de texto: ahí el cuerpo baja a
              14 px, que es la diferencia entre leer «Reunión con Marta» y leer
              «Reu…». Dos líneas y no tres: con tres, la duración se salía de la
              casilla mínima y el overflow se la comía sin avisar.

              shrink-0 en los dos: son items de un flex column, y sin él el
              navegador le roba altura al nombre y parte la última línea por la
              mitad en vez de recortarla limpiamente. */}
          <span
            className={`line-clamp-2 shrink-0 leading-tight ${shared === true ? 'text-sm' : 'text-base'} ${
              task.done ? 'text-ink-faint line-through' : 'text-ink'
            }`}
          >
            {task.text}
          </span>
          <span
            className={`mt-0.5 block shrink-0 truncate font-display tabular-nums text-ink-soft ${
              shared === true ? 'text-xs' : 'text-sm'
            }`}
          >
            {shortDurationLabel(task.estimatedMinutes)}
          </span>
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
