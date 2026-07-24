import { AuthSection } from '../components/settings/AuthSection'
import { GlobalThresholdSection } from '../components/settings/GlobalThresholdSection'
import { BackupSection } from '../components/settings/BackupSection'

/*
 * Ajustes y datos (CLAUDE.md §5.5): cuenta/sincronización, umbral de la racha
 * global y copia de seguridad. La hora de la notificación llega con la Fase 6.
 */
export function Settings() {
  return (
    <div className="mx-auto max-w-xl px-5 py-6 md:px-10 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Ajustes</h1>
      <AuthSection />
      <GlobalThresholdSection />
      <BackupSection />
    </div>
  )
}
