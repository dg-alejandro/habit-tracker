import { AuthSection } from '../components/settings/AuthSection'
import { BackupSection } from '../components/settings/BackupSection'

/*
 * Ajustes y datos (CLAUDE.md §5.5). En la Fase 2: cuenta/sincronización y
 * copia de seguridad. El umbral de la racha global llega con la Fase 3 y la
 * hora de la notificación con la Fase 6.
 */
export function Settings() {
  return (
    <div className="mx-auto max-w-xl px-5 py-6 md:px-10 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Ajustes</h1>
      <AuthSection />
      <BackupSection />
    </div>
  )
}
