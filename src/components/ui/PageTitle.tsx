import type { ReactNode } from 'react'

interface PageTitleProps {
  children: ReactNode
  /** Acción a la derecha del título, en la misma línea base. */
  action?: ReactNode
}

/**
 * Título de pantalla. Estaba copiado literalmente en las cinco páginas, y en
 * Hábitos producía dos filetes apilados (el del contenedor y el del h1).
 *
 * Aquí el filete es uno y abarca la fila entera, no solo el ancho del texto.
 */
export function PageTitle({ children, action }: PageTitleProps) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 border-b border-line pb-4">
      <h1 className="font-display text-3xl uppercase tracking-[0.2em] text-ink">{children}</h1>
      {action}
    </div>
  )
}
