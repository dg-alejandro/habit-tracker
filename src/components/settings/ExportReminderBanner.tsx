import { Link } from 'react-router'

/**
 * Aviso discreto (CLAUDE.md §5.5): más de 30 días sin exportar la copia JSON.
 * Mismo molde sobrio que FrozenDayBanner — nada de rojos ni modales.
 */
export function ExportReminderBanner() {
  return (
    <div className="mt-6 rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-sm font-semibold text-ink">Más de 30 días sin copia de seguridad</p>
      <p className="mt-1 text-sm text-ink-soft">La exportación JSON es el único respaldo de tus datos.</p>
      <Link
        to="/ajustes"
        className="inline-flex h-11 items-center text-sm text-ink underline underline-offset-2"
      >
        Exportar ahora
      </Link>
    </div>
  )
}
