import { getSupabaseClient } from '../data/supabase'

export interface AuthResult {
  ok: boolean
}

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
  return {
    configured: client !== null,
    async signIn(email, password) {
      if (client === null) return { ok: false }
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      return { ok: error === null }
    },
    async signOut() {
      if (client === null) return
      await client.auth.signOut()
    },
  }
}
