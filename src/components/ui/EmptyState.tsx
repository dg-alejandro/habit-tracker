import type { ReactNode } from 'react'

interface EmptyStateProps {
  children: ReactNode
  className?: string
  /** Para los pocos casos en que el texto anuncia una espera y no un vacío. */
  role?: 'status'
}

/**
 * Texto de «aquí no hay nada». Una sola escala y un solo tono para toda la app:
 * antes convivían `text-sm text-ink-soft` en hábitos y estadísticas con
 * `text-base text-ink-faint` en el planificador, que además competía en peso con
 * el contenido real.
 *
 * Importante: esto significa VACÍO, no «cargando». Mientras un hook devuelve
 * `undefined` va un esqueleto, nunca esto.
 */
export function EmptyState({ children, className = '', role }: EmptyStateProps) {
  return (
    <p role={role} className={`text-sm text-ink-soft ${className}`}>
      {children}
    </p>
  )
}
