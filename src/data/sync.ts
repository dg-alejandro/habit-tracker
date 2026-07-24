/*
 * Motor de sincronización local-first (Fase 2).
 *
 * Piezas, de fuera hacia dentro:
 *   - SyncBackend: puerto mínimo hacia el servidor. El adaptador real
 *     (supabaseBackend) es fino y se verifica en navegador; los tests inyectan
 *     un fake que modela el contrato (guardia LWW + synced_at monótono).
 *   - createSyncEngine: subida (outbox con snapshot, coalescencia y read-back)
 *     y bajada (páginas keyset con cursor persistido por página). Testeable
 *     en node con fake-indexeddb: no toca window ni supabase-js.
 *   - startSync: cableado singleton para App.tsx — auth, online/visibilidad,
 *     debounce del outbox, backoff y siembra (pospuesta si hay configuración).
 *
 * Reglas de convergencia:
 *   - LWW por updated_at del cliente; el servidor descarta escrituras viejas
 *     (trigger lww_guard) y el read-back corrige aquí al perdedor.
 *   - El cursor SOLO avanza durante la bajada: ni el push ni el read-back lo
 *     tocan (se saltarían escrituras ajenas intercaladas).
 *   - La aplicación de filas remotas escribe DIRECTO a Dexie: nunca re-encola.
 *   - entries converge por su clave lógica [habitId+date], conservando el id local.
 */
import { liveQuery } from 'dexie'
import type { Table } from 'dexie'
import type { SupabaseClient } from '@supabase/supabase-js'
import { db as appDb, type HabitDb } from './db'
import { getSupabaseClient } from './supabase'
import { ensureSeeded } from './seed'
import { enqueueAllExisting } from './outbox'
import {
  CODECS,
  chunk,
  nextCursor,
  remoteTableName,
  resolveLww,
  sameRow,
  type LocalRowByTable,
  type PullCursor,
  type PulledRow,
  type RemoteRowByTable,
} from '../logic/sync'
import { SYNC_TABLES, type EpochMs, type OutboxEntry, type SyncTable } from './types'

const PULL_LIMIT = 1000
const PUSH_BATCH = 500
const DEBOUNCE_MS = 1_500
const RETRY_MIN_MS = 5_000
const RETRY_MAX_MS = 300_000

/* ── Puerto hacia el servidor ─────────────────────────────────────────────── */

export interface SyncBackend {
  /** Upsert por lotes. El servidor aplica su guardia LWW fila a fila. */
  upsert<T extends SyncTable>(table: T, rows: ReadonlyArray<RemoteRowByTable[T]>): Promise<void>
  /** Borrado lógico remoto. Si la fila nunca llegó al servidor, no-op. */
  markDeleted(table: SyncTable, rowId: string, deletedAt: EpochMs): Promise<void>
  /** Página ordenada por (synced_at, id), estrictamente después del cursor. */
  pullPage<T extends SyncTable>(
    table: T,
    after: PullCursor | null,
    limit: number,
  ): Promise<Array<PulledRow<T>>>
  /** Relectura de filas concretas tras la subida (corrige al perdedor de la guardia). */
  readBack<T extends SyncTable>(
    table: T,
    by: 'id' | 'date',
    values: readonly string[],
  ): Promise<Array<PulledRow<T>>>
}

/** Adaptador PostgREST. Fino a propósito: se verifica en navegador, no en tests. */
export function supabaseBackend(client: SupabaseClient): SyncBackend {
  return {
    async upsert(table, rows) {
      const { error } = await client.from(remoteTableName(table)).upsert([...rows])
      if (error !== null) throw new Error(`Subida de ${table}: ${error.message}`)
    },

    async markDeleted(table, rowId, deletedAt) {
      const { error } = await client
        .from(remoteTableName(table))
        .update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq('id', rowId)
      if (error !== null) throw new Error(`Borrado en ${table}: ${error.message}`)
    },

    async pullPage(table, after, limit) {
      let query = client.from(remoteTableName(table)).select('*')
      if (after !== null) {
        // Keyset (synced_at, id); los valores van entrecomillados por los ':' y '+'.
        query = query.or(
          `synced_at.gt."${after.syncedAt}",and(synced_at.eq."${after.syncedAt}",id.gt."${after.rowId}")`,
        )
      }
      const { data, error } = await query
        .order('synced_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit)
      if (error !== null) throw new Error(`Bajada de ${table}: ${error.message}`)
      return (data ?? []) as Array<PulledRow<typeof table>>
    },

    async readBack(table, by, values) {
      const { data, error } = await client
        .from(remoteTableName(table))
        .select('*')
        .in(by, [...values])
      if (error !== null) throw new Error(`Relectura de ${table}: ${error.message}`)
      return (data ?? []) as Array<PulledRow<typeof table>>
    },
  }
}

/* ── Estado observable (useSyncExternalStore) ─────────────────────────────── */

export interface EngineSnapshot {
  syncing: boolean
  /** Mensaje del último fallo, o null si el último ciclo terminó bien. */
  lastError: string | null
  lastSyncedAt: EpochMs | null
}

export interface EngineStore {
  getSnapshot(): EngineSnapshot
  subscribe(listener: () => void): () => void
  set(patch: Partial<EngineSnapshot>): void
}

export function createEngineStore(): EngineStore {
  let snapshot: EngineSnapshot = { syncing: false, lastError: null, lastSyncedAt: null }
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(patch) {
      snapshot = { ...snapshot, ...patch }
      for (const listener of listeners) listener()
    },
  }
}

/** Store global que lee la UI; startSync() conecta su motor aquí. */
export const syncStore: EngineStore = createEngineStore()

/* ── Motor ────────────────────────────────────────────────────────────────── */

export type SyncMode = 'full' | 'push'

export interface SyncEngineDeps {
  db: HabitDb
  backend: SyncBackend
  store?: EngineStore
  now?: () => EpochMs
  /** Siembra inyectable (los tests usan una base propia). */
  seed?: (db: HabitDb) => Promise<void>
}

export interface SyncEngine {
  /** Serializado (single-flight); las peticiones en vuelo se funden en una cola de uno. */
  syncNow(mode: SyncMode): Promise<boolean>
  /** Guardia de cuenta + bajada completa + siembra pospuesta (primera vez). */
  initialSync(userId: string): Promise<boolean>
  getSnapshot(): EngineSnapshot
  subscribe(listener: () => void): () => void
}

function localTable<T extends SyncTable>(db: HabitDb, table: T): Table<LocalRowByTable[T], string> {
  return db.table(table) as Table<LocalRowByTable[T], string>
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { db, backend } = deps
  const store = deps.store ?? createEngineStore()
  const now = deps.now ?? (() => Date.now())
  const seed = deps.seed ?? ensureSeeded

  /* Cursores keyset por tabla */

  function cursorId<T extends SyncTable>(table: T): `cursor:${T}` {
    return `cursor:${table}`
  }

  async function getCursor(table: SyncTable): Promise<PullCursor | null> {
    const row = await db.syncMeta.get(cursorId(table))
    if (row === undefined || !('syncedAt' in row)) return null
    return { syncedAt: row.syncedAt, rowId: row.rowId }
  }

  function putCursor(table: SyncTable, cursor: PullCursor): Promise<string> {
    return db.syncMeta.put({ id: cursorId(table), syncedAt: cursor.syncedAt, rowId: cursor.rowId })
  }

  /* Aplicación de filas remotas (bajada y read-back). Nunca encola. */

  async function applyPulledEntry(row: PulledRow<'entries'>): Promise<void> {
    // La identidad de un registro es su clave lógica; el id remoto no se adopta
    // si ya hay fila local (chocaría con el índice único &[habitId+date]).
    const local = await db.entries.where('[habitId+date]').equals([row.habit_id, row.date]).first()
    if (local === undefined) {
      if (row.deleted_at === null) await db.entries.put(CODECS.entries.fromRemote(row))
      return
    }
    if (resolveLww(local.updatedAt, row.updated_at) === 'local') return
    if (row.deleted_at !== null) {
      await db.entries.delete(local.id)
      return
    }
    const mapped = { ...CODECS.entries.fromRemote(row), id: local.id }
    if (!sameRow(mapped, local)) await db.entries.put(mapped)
  }

  async function applyPulledRow<T extends SyncTable>(table: T, row: PulledRow<T>): Promise<void> {
    if (table === 'entries') {
      await applyPulledEntry(row as PulledRow<'entries'>)
      return
    }
    const target = localTable(db, table)
    const local = await target.get(row.id)
    if (local === undefined) {
      if (row.deleted_at === null) await target.put(CODECS[table].fromRemote(row))
      return
    }
    if (resolveLww(local.updatedAt, row.updated_at) === 'local') return
    if (row.deleted_at !== null) {
      await target.delete(row.id)
      return
    }
    const mapped = CODECS[table].fromRemote(row)
    if (!sameRow(mapped, local)) await target.put(mapped)
  }

  /* Bajada: páginas keyset; cada página se aplica y persiste su cursor en la
     MISMA transacción (un corte a mitad reanuda donde iba). */

  async function pullTable<T extends SyncTable>(table: T): Promise<void> {
    for (;;) {
      const cursor = await getCursor(table)
      const rows = await backend.pullPage(table, cursor, PULL_LIMIT)
      if (rows.length === 0) return
      await db.transaction('rw', [db.table(table), db.syncMeta], async () => {
        for (const row of rows) await applyPulledRow(table, row)
        const next = nextCursor(rows.map((row) => ({ synced_at: row.synced_at, id: row.id })))
        if (next !== null) await putCursor(table, next)
      })
      if (rows.length < PULL_LIMIT) return
    }
  }

  async function pullAll(): Promise<void> {
    for (const table of SYNC_TABLES) await pullTable(table)
  }

  /* Subida: snapshot → coalescencia → filas vivas → upsert/borrado → read-back
     → borrar SOLO los seqs del snapshot (una edición en vuelo sobrevive). */

  async function pushTable<T extends SyncTable>(table: T, ops: OutboxEntry[]): Promise<void> {
    const upsertIds = ops.filter((op) => op.op === 'upsert').map((op) => op.rowId)
    const liveRows = (await localTable(db, table).bulkGet(upsertIds)).filter(
      (row): row is LocalRowByTable[T] => row !== undefined,
    )
    const codec = CODECS[table]
    for (const batch of chunk(liveRows, PUSH_BATCH)) {
      await backend.upsert(table, batch.map((row) => codec.toRemote(row)))
    }
    for (const op of ops.filter((o) => o.op === 'delete')) {
      await backend.markDeleted(table, op.rowId, op.deletedAt ?? now())
    }
    // Read-back: si la guardia del servidor descartó algo nuestro, aquí nos
    // corregimos. entries se relee por fecha (su identidad remota es la clave
    // lógica y el id puede no coincidir); el resto por id, borrados incluidos.
    const values =
      table === 'entries'
        ? [...new Set(liveRows.map((row) => (row as LocalRowByTable['entries']).date))]
        : [...new Set(ops.map((op) => op.rowId))]
    if (values.length === 0) return
    const echoed = await backend.readBack(table, table === 'entries' ? 'date' : 'id', values)
    if (echoed.length === 0) return
    await db.transaction('rw', [db.table(table)], async () => {
      for (const row of echoed) await applyPulledRow(table, row)
    })
  }

  async function pushOnce(): Promise<boolean> {
    const snapshot = await db.outbox.orderBy('seq').toArray()
    if (snapshot.length === 0) return false
    const latest = new Map<string, OutboxEntry>()
    for (const entry of snapshot) latest.set(`${entry.table}|${entry.rowId}`, entry)
    for (const table of SYNC_TABLES) {
      const ops = [...latest.values()].filter((entry) => entry.table === table)
      if (ops.length > 0) await pushTable(table, ops)
    }
    const seqs = snapshot.flatMap((entry) => (entry.seq === undefined ? [] : [entry.seq]))
    await db.outbox.bulkDelete(seqs)
    return true
  }

  async function pushAll(): Promise<void> {
    // Lo que entre durante un vuelo queda con seq mayor y se recoge en la
    // siguiente vuelta; la cola vacía corta el bucle.
    while (await pushOnce()) {
      /* seguir drenando */
    }
  }

  /* Orquestación serializada */

  let inFlight: Promise<boolean> | null = null
  let queuedMode: SyncMode | null = null

  async function run(mode: SyncMode): Promise<boolean> {
    store.set({ syncing: true })
    try {
      if (mode === 'full') await pullAll()
      await pushAll()
      store.set({ syncing: false, lastError: null, lastSyncedAt: now() })
      return true
    } catch (error) {
      store.set({
        syncing: false,
        lastError: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  function syncNow(mode: SyncMode): Promise<boolean> {
    if (inFlight !== null) {
      queuedMode = queuedMode === 'full' || mode === 'full' ? 'full' : 'push'
      return inFlight
    }
    inFlight = run(mode)
      .then(async (ok) => {
        let result = ok
        while (queuedMode !== null) {
          const next = queuedMode
          queuedMode = null
          result = await run(next)
        }
        return result
      })
      .finally(() => {
        inFlight = null
      })
    return inFlight
  }

  async function initialSync(userId: string): Promise<boolean> {
    // Guardia de cuenta: si el usuario cambió, los cursores y la marca de
    // primera bajada no valen; lo local se re-encola entero y LWW re-fusiona.
    const account = await db.syncMeta.get('account')
    if (account !== undefined && account.id === 'account' && account.userId !== userId) {
      await db.syncMeta.clear()
      await enqueueAllExisting(db)
    }
    await db.syncMeta.put({ id: 'account', userId })

    const ok = await syncNow('full')
    if (!ok) return false

    // Siembra pospuesta: solo tras la primera bajada completa con sesión, y
    // solo si no bajó ningún hábito (dispositivo nuevo de una cuenta nueva).
    if ((await db.syncMeta.get('firstPull')) === undefined) {
      if ((await db.habits.count()) === 0) await seed(db)
      await db.syncMeta.put({ id: 'firstPull', at: now() })
      return syncNow('push')
    }
    return true
  }

  return {
    syncNow,
    initialSync,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
  }
}

/* ── Cableado singleton para la app ───────────────────────────────────────── */

let started = false
let globalEngine: SyncEngine | null = null

/** Dispara un ciclo completo a demanda (botón «Reintentar» de /ajustes). */
export function requestSyncNow(): void {
  if (globalEngine !== null) void globalEngine.syncNow('full')
}

/**
 * Idempotente (el StrictMode dispara el efecto dos veces). Sin configuración
 * de Supabase siembra y termina: la app queda 100 % local, como en la Fase 1.
 */
export function startSync(): void {
  if (started) return
  started = true

  const client = getSupabaseClient()
  if (client === null) {
    void ensureSeeded()
    return
  }

  const engine = createSyncEngine({ db: appDb, backend: supabaseBackend(client), store: syncStore })
  globalEngine = engine

  let sessionUserId: string | null = null
  let retryDelayMs = RETRY_MIN_MS
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const clearRetry = (): void => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const scheduleRetry = (): void => {
    if (retryTimer !== null) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS)
      if (sessionUserId !== null) runGuarded(() => engine.syncNow('full'))
    }, retryDelayMs)
  }

  /** Ejecuta un ciclo y programa el reintento con backoff si falla. */
  const runGuarded = (cycle: () => Promise<boolean>): void => {
    void cycle().then((ok) => {
      if (ok) {
        retryDelayMs = RETRY_MIN_MS
        clearRetry()
      } else {
        scheduleRetry()
      }
    })
  }

  // Subida en segundo plano: cualquier encolado dispara un push con debounce.
  liveQuery(() => appDb.outbox.count()).subscribe({
    next(count) {
      if (count === 0 || sessionUserId === null) return
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        runGuarded(() => engine.syncNow('push'))
      }, DEBOUNCE_MS)
    },
  })

  // Al volver la red o el foco (abrir la PWA cuenta como visibilitychange).
  window.addEventListener('online', () => {
    if (sessionUserId !== null) runGuarded(() => engine.syncNow('full'))
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sessionUserId !== null) {
      runGuarded(() => engine.syncNow('full'))
    }
  })

  // Auth: INITIAL_SESSION llega al arrancar con la sesión persistida (si la hay).
  // El trabajo se difiere con setTimeout: supabase-js desaconseja llamadas a la
  // propia librería dentro del callback (retiene un lock interno).
  client.auth.onAuthStateChange((event, session) => {
    const userId = session?.user.id ?? null
    if (userId === null) {
      sessionUserId = null
      clearRetry()
      return
    }
    const isNewSession = sessionUserId !== userId
    sessionUserId = userId
    if (isNewSession && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      setTimeout(() => {
        runGuarded(() => engine.initialSync(userId))
      }, 0)
    }
  })
}
