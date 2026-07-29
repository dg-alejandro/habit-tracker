import { Link } from 'react-router'
import { NoticeBanner } from '../ui/NoticeBanner'
import { NOTICE_ACTION } from '../ui/classes'

/** Aviso discreto (CLAUDE.md §5.5): más de 30 días sin exportar la copia JSON. */
export function ExportReminderBanner() {
  return (
    <NoticeBanner
      className="mt-6"
      title="Más de 30 días sin copia de seguridad"
      detail="La exportación JSON es el único respaldo de tus datos."
      actions={
        <Link to="/ajustes" className={NOTICE_ACTION}>
          Exportar ahora
        </Link>
      }
    />
  )
}
