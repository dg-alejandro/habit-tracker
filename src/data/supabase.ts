/*
 * Cliente de Supabase. Solo existe si las variables de entorno están presentes
 * y tienen pinta de reales (el .env recién creado lleva marcadores): sin
 * cliente, la app funciona 100 % en local y el indicador lo dice.
 *
 * Nadie más importa supabase-js directamente: el motor lo recibe envuelto en
 * el puerto SyncBackend (data/sync.ts) y la UI solo usa auth vía hooks.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null
}

/** Memoizado; null si el .env no está relleno. */
export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  client =
    url !== undefined && url.startsWith('https://') && anonKey !== undefined && anonKey !== ''
      ? createClient(url, anonKey, {
          // Sesión persistente (localStorage) y refresco automático: los
          // defaults de supabase-js. Sin OAuth no hay nada que detectar en la URL.
          auth: { detectSessionInUrl: false },
        })
      : null
  return client
}
