import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSession } from '../../hooks/useSession'
import { useSyncStatus, type SyncStatus } from '../../hooks/useSyncStatus'

const STATUS_DETAIL: Record<SyncStatus, string> = {
  disabled:
    'Solo local: faltan las claves de Supabase en el .env. Los datos no salen de este dispositivo.',
  signedOut: 'Inicia sesión para sincronizar entre el PC y el iPhone.',
  error: 'Los cambios están guardados en este dispositivo; se reintentará solo.',
  offline: 'Sin conexión. Se sincronizará al recuperarla.',
  pending: 'Subiendo cambios…',
  synced: 'Sincronizado.',
}

/**
 * Cuenta y estado de sincronización. Usuario único creado a mano en el panel
 * de Supabase: aquí solo hay inicio de sesión, nunca registro (SETUP.md §2).
 * Todo el acceso a datos pasa por hooks (CLAUDE.md §2).
 */
export function AuthSection() {
  const { configured, signIn, signOut } = useAuth()
  const session = useSession()
  const { status, pendingCount, lastError, retry } = useSyncStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!configured || submitting) return
    setSubmitting(true)
    setAuthError(null)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setAuthError('No se pudo iniciar sesión. Revisa el correo y la contraseña.')
      return
    }
    setPassword('')
  }

  const statusLine =
    status === 'pending' && pendingCount > 0
      ? `${pendingCount} ${pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'} de subir.`
      : STATUS_DETAIL[status]

  return (
    <section className="mt-12">
      <h2 className="text-xs font-medium uppercase tracking-widest text-ink-soft">
        Cuenta y sincronización
      </h2>

      {!configured && <p className="mt-3 text-sm text-ink-soft">{STATUS_DETAIL.disabled}</p>}

      {configured && session === null && (
        <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-ink-soft">{STATUS_DETAIL.signedOut}</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">
              Correo
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">
              Contraseña
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint"
            />
          </label>
          {authError !== null && <p className="text-sm font-semibold text-ink">{authError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-30"
          >
            {submitting ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
      )}

      {configured && session !== null && session !== undefined && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-ink">{session.email ?? 'Sesión iniciada'}</p>
          <p className={`text-sm ${status === 'error' ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
            {statusLine}
            {status === 'error' && lastError !== null && (
              <span className="mt-1 block font-normal text-ink-faint">{lastError}</span>
            )}
          </p>
          <div className="flex gap-3">
            {status === 'error' && (
              <button
                type="button"
                onClick={retry}
                className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-paper"
              >
                Reintentar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void signOut()
              }}
              className="h-11 rounded-lg px-4 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
