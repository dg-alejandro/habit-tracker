import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { requestSyncNow, syncStore } from '../data/sync'
import { isSupabaseConfigured } from '../data/supabase'
import { resolveSyncStatus, type SyncStatus } from '../logic/sync'
import { useSession } from './useSession'

export type { SyncStatus }

export interface SyncState {
  status: SyncStatus
  /** Cambios locales aún sin subir. */
  pendingCount: number
  syncing: boolean
  lastError: string | null
  /** Dispara un ciclo completo a demanda (botón «Reintentar»). */
  retry: () => void
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = (): void => setOnline(true)
    const down = (): void => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

/**
 * Cableado de las cuatro suscripciones; la decisión de qué estado mostrar vive
 * en `resolveSyncStatus` (logic/sync.ts), que es pura y sí se puede probar.
 */
export function useSyncStatus(): SyncState {
  const snapshot = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot)
  const session = useSession()
  const online = useOnline()
  const pendingCount = useLiveQuery(() => db.outbox.count(), [], 0)

  const status = resolveSyncStatus({
    configured: isSupabaseConfigured(),
    session: session === null ? 'none' : session === undefined ? 'restoring' : 'active',
    lastError: snapshot.lastError,
    online,
    pendingCount,
    syncing: snapshot.syncing,
  })

  return {
    status,
    pendingCount,
    syncing: snapshot.syncing,
    lastError: snapshot.lastError,
    retry: requestSyncNow,
  }
}
