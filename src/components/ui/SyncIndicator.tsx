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
 * - 'tab': marcador tipográfico junto a la etiqueta «Ajustes» del móvil,
 *   solo cuando hay algo que decir; no desplaza el layout.
 * El detalle completo vive en /ajustes. Nada de streak-red: el rojo está
 * reservado a la ruptura de rachas (Fase 3).
 */
export function SyncIndicator({ variant }: { variant: 'aside' | 'tab' }) {
  const { status, pendingCount } = useSyncStatus()

  if (variant === 'tab') {
    if (status === 'synced' || status === 'disabled') return null
    const attention = status === 'error' || status === 'signedOut'
    return (
      <span
        aria-hidden
        className={`ml-1 font-semibold ${attention ? 'text-ink' : 'text-ink-soft'}`}
      >
        {attention ? '!' : '·'}
      </span>
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
      className={`mt-auto rounded-md px-3 py-2 text-xs transition-colors hover:bg-surface hover:text-ink ${
        emphasis ? 'font-semibold text-ink' : 'text-ink-soft'
      }`}
    >
      {label}
    </Link>
  )
}
