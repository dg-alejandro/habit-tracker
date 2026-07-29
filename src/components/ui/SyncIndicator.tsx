import { Link } from 'react-router'
import { useSyncStatus, type SyncStatus } from '../../hooks/useSyncStatus'

const ASIDE_LABELS: Record<SyncStatus, string> = {
  disabled: 'Solo local',
  signedOut: 'Sin sesión',
  error: 'Error de sincronización',
  offline: 'Sin conexión',
  pending: 'Sincronizando…',
  synced: 'Sincronizado',
}

/**
 * Indicador discreto y monocromo del estado de sincronización (CLAUDE.md §2).
 * - 'aside': línea de texto al pie de la barra lateral de escritorio.
 * - 'tab': insignia en la esquina de la pestaña «Ajustes» del móvil, solo
 *   cuando hay algo que decir. Va en absoluto (la pestaña es `relative`) para
 *   que su aparición no mueva la etiqueta: el tránsito sincronizado↔pendiente
 *   ocurre en cada marcado nocturno.
 * El detalle completo vive en /ajustes. Nada de streak-red: el rojo está
 * reservado a la ruptura de rachas (Fase 3).
 */
export function SyncIndicator({ variant }: { variant: 'aside' | 'tab' }) {
  const { status, pendingCount } = useSyncStatus()

  if (variant === 'tab') {
    if (status === 'synced' || status === 'disabled') return null
    const attention = status === 'error' || status === 'signedOut'
    return (
      <>
        <span
          aria-hidden
          className={`absolute right-2.5 top-1.5 font-display text-xs font-semibold ${
            attention ? 'text-ink' : 'text-ink-soft'
          }`}
        >
          {attention ? '!' : '·'}
        </span>
        {/* El glifo sigue oculto para que su aparición no mueva la etiqueta,
            pero el estado entra en el nombre accesible de la pestaña: «Ajustes,
            sin conexión». Cierra la deuda de accesibilidad de la Fase 2, que
            dejaba esto invisible para un lector de pantalla en el iPhone. */}
        <span className="sr-only">, {ASIDE_LABELS[status]}</span>
      </>
    )
  }

  const label =
    status === 'pending' && pendingCount > 0
      ? `Pendiente (${pendingCount})`
      : ASIDE_LABELS[status]
  const emphasis = status === 'error' || status === 'signedOut'
  return (
    <Link
      to="/ajustes"
      className={`mt-auto rounded-sm px-3 py-2 font-display text-xs transition-colors hover:bg-surface hover:text-ink ${
        emphasis ? 'font-semibold text-ink' : 'text-ink-soft'
      }`}
    >
      {label}
    </Link>
  )
}
