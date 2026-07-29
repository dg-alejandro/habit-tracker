import { getSupabaseClient } from '../data/supabase'
import { classifyAuthError, type AuthFailure } from '../logic/sync'
import { useOnline } from './useSyncStatus'

export type AuthResult = { ok: true } | { ok: false; reason: AuthFailure; detail?: string }

export interface AuthActions {
  /** false = faltan las claves en el .env: la app funciona solo en local. */
  configured: boolean
  signIn(email: string, password: string): Promise<AuthResult>
  signOut(): Promise<void>
}

/**
 * Acciones de sesión. Único punto de la UI que toca la auth de supabase-js:
 * los componentes no hablan con Supabase directamente (CLAUDE.md §2).
 * La sesión reactiva vive en useSession; el estado del motor, en useSyncStatus.
 */
export function useAuth(): AuthActions {
  const client = getSupabaseClient()
  const online = useOnline()

  return {
    configured: client !== null,
    async signIn(email, password) {
      if (client === null) return { ok: false, reason: 'unconfigured' }
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error === null) return { ok: true }
      // Antes aquí se tiraba el objeto de error y solo se devolvía `ok`, así que
      // quedarse sin cobertura decía «revisa el correo y la contraseña».
      return {
        ok: false,
        reason: classifyAuthError(error, online),
        detail: error.message,
      }
    },
    async signOut() {
      if (client === null) return
      await client.auth.signOut()
    },
  }
}
