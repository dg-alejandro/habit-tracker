import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSession } from '../../hooks/useSession'
import { useSyncStatus, type SyncStatus } from '../../hooks/useSyncStatus'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD_CLASS } from '../ui/classes'
import type { AuthFailure } from '../../logic/sync'

const STATUS_DETAIL: Record<SyncStatus, string> = {
  disabled:
    'Solo local: faltan las claves de Supabase en el .env. Los datos no salen de este dispositivo.',
  signedOut: 'Inicia sesión para sincronizar entre el PC y el iPhone.',
  error: 'Los cambios están guardados en este dispositivo; se reintentará solo.',
  offline: 'Sin conexión. Se sincronizará al recuperarla.',
  pending: 'Subiendo cambios…',
  synced: 'Sincronizado.',
}

/*
 * Antes había un solo mensaje para todo: «Revisa el correo y la contraseña».
 * Y §9 avisa de que Supabase pausa los proyectos tras una semana sin actividad,
 * así que el fallo más probable al volver de vacaciones mandaba al propietario
 * a buscar una contraseña que estaba perfectamente bien.
 */
const AUTH_FAILURE_MESSAGE: Record<AuthFailure, string> = {
  credentials: 'No se pudo iniciar sesión. Revisa el correo y la contraseña.',
  network:
    'No se ha podido contactar con Supabase. Puede que no haya conexión, o que el proyecto esté pausado por inactividad.',
  unconfigured: 'Faltan las claves de Supabase en el .env.',
  unknown: 'No se pudo iniciar sesión.',
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
  const [authError, setAuthError] = useState<{ text: string; detail?: string } | null>(null)

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!configured || submitting) return
    setSubmitting(true)
    setAuthError(null)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setAuthError({
        text: AUTH_FAILURE_MESSAGE[result.reason],
        ...(result.detail === undefined ? {} : { detail: result.detail }),
      })
      return
    }
    setPassword('')
  }

  const statusLine =
    status === 'pending' && pendingCount > 0
      ? `${pendingCount} ${pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'} de subir.`
      : status === 'offline' && pendingCount > 0
      ? `Sin conexión. ${pendingCount} ${pendingCount === 1 ? 'cambio' : 'cambios'} en cola; se subirán al recuperarla.`
      : STATUS_DETAIL[status]

  return (
    <section className="mt-12">
      <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">
        Cuenta y sincronización
      </h2>

      {!configured && <p className="mt-3 text-sm text-ink-soft">{STATUS_DETAIL.disabled}</p>}

      {configured && session === null && (
        <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-ink-soft">{STATUS_DETAIL.signedOut}</p>
          <label className="flex flex-col gap-1">
            <span className="font-display text-xs uppercase tracking-widest text-ink-soft">
              Correo
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`w-full ${FIELD_CLASS}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-display text-xs uppercase tracking-widest text-ink-soft">
              Contraseña
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`w-full ${FIELD_CLASS}`}
            />
          </label>
          {authError !== null && (
            <p role="alert" className="text-sm font-semibold text-ink">
              {authError.text}
              {authError.detail !== undefined && (
                <span className="mt-1 block font-display text-xs font-normal text-ink-faint">
                  {authError.detail}
                </span>
              )}
            </p>
          )}
          <button type="submit" disabled={submitting} className={BUTTON_PRIMARY}>
            {submitting ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
      )}

      {/* Ninguna rama cubría `undefined`, que es «restaurando la sesión»: se
          quedaba solo el título sobre un hueco mudo. */}
      {configured && session === undefined && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          Comprobando la sesión…
        </p>
      )}

      {configured && session !== null && session !== undefined && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-ink">{session.email ?? 'Sesión iniciada'}</p>
          <p
            role="status"
            className={`text-sm ${status === 'error' ? 'font-semibold text-ink' : 'text-ink-soft'}`}
          >
            {statusLine}
            {status === 'error' && lastError !== null && (
              <span className="mt-1 block font-display text-xs font-normal text-ink-faint">
                {lastError}
              </span>
            )}
          </p>
          <div className="flex gap-3">
            {/* Solo con `error`: sin conexión no hay nada que reintentar, y
                ahora `offline` gana a `error` en la precedencia. */}
            {status === 'error' && (
              <button type="button" onClick={retry} className={BUTTON_PRIMARY}>
                Reintentar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void signOut()
              }}
              className={BUTTON_QUIET}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
