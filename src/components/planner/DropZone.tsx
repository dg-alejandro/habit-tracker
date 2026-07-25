import type { ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { dropTargetId, type DropTarget } from '../../logic/planner'
import type { PlannerTask } from '../../data/types'

interface DropZoneProps {
  target: DropTarget
  className?: string
  /** Estilo geométrico: lo usan las celdas de la cuadrícula, posicionadas en absoluto. */
  style?: React.CSSProperties
  children: ReactNode
}

/**
 * Zona de soltado. Al pasar una tarea por encima se ilumina en lima: es el
 * único momento en que hace falta gritar «suelta aquí», y encaja con lo que
 * el lima significa en el resto de la app (§6).
 */
export function DropZone({ target, className, style, children }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dropTargetId(target) })
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className ?? ''} ${isOver ? 'bg-surface outline outline-streak-lime' : ''}`}
    >
      {children}
    </div>
  )
}

interface DraggableTaskProps {
  task: PlannerTask
  /**
   * 'row' cuelga el arrastre de un asa de 44 px; 'grid' hace arrastrable el chip
   * entero. Ver la nota de sensores en Planner.tsx.
   */
  density: 'row' | 'grid'
  children: (handle: ReactNode) => ReactNode
}

/**
 * Envuelve una tarea para poder arrastrarla. En densidad 'row' entrega un asa
 * con `touch-none` (el patrón ya probado en la lista de hábitos) para que el
 * resto de la fila siga scrolleando; en 'grid' el chip entero es el asa, porque
 * ahí un asa de 44 px no cabe y las celdas vacías —que son casi toda la
 * superficie— siguen scrolleando con normalidad.
 */
export function DraggableTask({ task, density, children }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })

  if (density === 'grid') {
    // Sin `attributes`: pondrían role="button" y tabIndex sobre un contenedor
    // que ya lleva dentro los dos botones reales del chip. Los `listeners`
    // bastan para arrastrar, y el teclado sigue llegando a los botones.
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        className={`h-full w-full cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
      >
        {children(null)}
      </div>
    )
  }

  const handle = (
    <button
      type="button"
      aria-label={`Mover ${task.text}`}
      {...attributes}
      {...listeners}
      className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center text-ink-faint active:cursor-grabbing"
    >
      <GripIcon />
    </button>
  )

  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-30' : ''}>
      {children(handle)}
    </div>
  )
}

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <circle cx="7" cy="5" r="1.5" />
      <circle cx="13" cy="5" r="1.5" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <circle cx="7" cy="15" r="1.5" />
      <circle cx="13" cy="15" r="1.5" />
    </svg>
  )
}
