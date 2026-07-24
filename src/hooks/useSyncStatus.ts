import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { requestSyncNow, syncStore } from '../data/sync'
import { isSupabaseConfigured } from '../data/supabase'
import { useSession } from './useSession'

/** Precedencia: disabled > signedOut > error > offline > pending > synced. */
export type SyncStatus = 'disabled' | 'signedOut' | 'error' | 'offline' | 'pending' | 'synced'

export interface SyncState {
  status: SyncStatus
  /** Cambios locales aún sin subir. */
  pendingCount: number
  syncing: boolean
  lastError: string | null
  /** Dispara un ciclo completo a demanda (botón «Reintentar»). */
  retry: () => void
}

function useOnline(): boolean {
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

export function useSyncStatus(): SyncState {
  const snapshot = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot)
  const session = useSession()
  const online = useOnline()
  const pendingCount = useLiveQuery(() => db.outbox.count(), [], 0)

  let status: SyncStatus
  if (!isSupabaseConfigured()) status = 'disabled'
  else if (session === null) status = 'signedOut'
  else if (snapshot.lastError !== null) status = 'error'
  else if (!online) status = 'offline'
  else if (pendingCount > 0 || snapshot.syncing || session === undefined) status = 'pending'
  else status = 'synced'

  return {
    status,
    pendingCount,
    syncing: snapshot.syncing,
    lastError: snapshot.lastError,
    retry: requestSyncNow,
  }
}
