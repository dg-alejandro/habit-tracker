import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../data/supabase'

export interface SessionInfo {
  email: string | null
  userId: string
}

/**
 * Sesión de Supabase: undefined mientras se restaura, null sin sesión (o sin
 * configuración). onAuthStateChange emite INITIAL_SESSION nada más suscribirse.
 */
export function useSession(): SessionInfo | null | undefined {
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined)

  useEffect(() => {
    const client = getSupabaseClient()
    if (client === null) {
      setSession(null)
      return
    }
    const { data } = client.auth.onAuthStateChange((_event, current) => {
      setSession(
        current === null ? null : { email: current.user.email ?? null, userId: current.user.id },
      )
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  return session
}
