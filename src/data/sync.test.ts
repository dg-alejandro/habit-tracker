/*
 * Tests de integración del motor de sincronización: Dexie REAL sobre
 * fake-indexeddb y un backend falso en memoria que modela el contrato del
 * servidor: guardia LWW (como el trigger lww_guard) y synced_at monótono
 * estampado por el "servidor", con grupos de timestamp idéntico.
 */
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { HabitDb, db as singletonDb } from './db'
import { createSyncEngine, type SyncBackend, type SyncEngine } from './sync'
import { ensureSeeded } from './seed'
import * as habitsRepo from './repositories/habitsRepo'
import * as entriesRepo from './repositories/entriesRepo'
import * as frozenRepo from './repositories/frozenRepo'
import { isAfterCursor, type PullCursor, type PulledRow, type RemoteRowByTable } from '../logic/sync'
import { SYNC_TABLES, type DayEntry, type FrozenRange, type Habit, type SyncTable } from './types'

/* ── Backend falso ────────────────────────────────────────────────────────── */

type StoredRow = Record<string, unknown> & {
  id: string
  updated_at: number
  deleted_at: number | null
  synced_at: string
}

class FakeBackend implements SyncBackend {
  private tables = new Map<SyncTable, Map<string, StoredRow>>()
  private tick = 0
  private frozenStamp: string | null = null
  /** Nº de próximas llamadas de red que fallan. */
  failNext = 0
  /** Llamadas que aún pasan antes de empezar a fallar (cortes deterministas). */
  skipBeforeFail = 0
  /** Registro de lotes subidos, para las aserciones de coalescencia. */
  upsertBatches: Array<{ table: SyncTable; rows: Array<Record<string, unknown>> }> = []
  deleteCalls: Array<{ table: SyncTable; rowId: string; deletedAt: number }> = []
  private gate: { started: () => void; wait: Promise<void> } | null = null

  /** La próxima subida se detiene hasta `release()`; `started` resuelve al entrar. */
  holdNextUpsert(): { started: Promise<void>; release: () => void } {
    let signalStarted!: () => void
    let release!: () => void
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve
    })
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })
    this.gate = { started: signalStarted, wait }
    return { started, release }
  }

  private stamp(): string {
    if (this.frozenStamp !== null) return this.frozenStamp
    this.tick += 1
    return String(this.tick).padStart(12, '0')
  }

  /** Congela synced_at: todo lo estampado hasta descongelar comparte timestamp. */
  freezeStamp(): void {
    this.tick += 1
    this.frozenStamp = String(this.tick).padStart(12, '0')
  }

  unfreezeStamp(): void {
    this.frozenStamp = null
  }

  private tableMap(table: SyncTable): Map<string, StoredRow> {
    let map = this.tables.get(table)
    if (map === undefined) {
      map = new Map()
      this.tables.set(table, map)
    }
    return map
  }

  /** La PK remota de entries es la clave lógica; el resto, el id. */
  private keyOf(table: SyncTable, row: Record<string, unknown>): string {
    return table === 'entries' ? `${String(row.habit_id)}|${String(row.date)}` : String(row.id)
  }

  private net(): void {
    if (this.skipBeforeFail > 0) {
      this.skipBeforeFail -= 1
      return
    }
    if (this.failNext > 0) {
      this.failNext -= 1
      throw new Error('red caída (fake)')
    }
  }

  /** Siembra directa del "servidor" (sin pasar por la guardia). */
  seedRemote(table: SyncTable, rows: Array<Record<string, unknown>>): void {
    for (const row of rows) {
      const stored = { deleted_at: null, ...row, synced_at: this.stamp() } as StoredRow
      this.tableMap(table).set(this.keyOf(table, stored), stored)
    }
  }

  rowsOf(table: SyncTable): StoredRow[] {
    return [...this.tableMap(table).values()]
  }

  async upsert<T extends SyncTable>(
    table: T,
    rows: ReadonlyArray<RemoteRowByTable[T]>,
  ): Promise<void> {
    this.net()
    if (this.gate !== null) {
      const gate = this.gate
      this.gate = null
      gate.started()
      await gate.wait
    }
    const received: Array<Record<string, unknown>> = []
    for (const raw of rows) {
      const row = raw as unknown as Record<string, unknown> & { updated_at: number }
      received.push(row)
      const map = this.tableMap(table)
      const key = this.keyOf(table, row)
      const existing = map.get(key)
      // Guardia LWW del servidor: una escritura más antigua se descarta.
      if (existing !== undefined && row.updated_at < existing.updated_at) continue
      map.set(key, { deleted_at: null, ...row, synced_at: this.stamp() } as StoredRow)
    }
    this.upsertBatches.push({ table, rows: received })
  }

  async markDeleted(table: SyncTable, rowId: string, deletedAt: number): Promise<void> {
    this.net()
    this.deleteCalls.push({ table, rowId, deletedAt })
    const map = this.tableMap(table)
    for (const [key, row] of map) {
      if (row.id !== rowId) continue
      if (deletedAt < row.updated_at) return // guardia: una edición más nueva gana al borrado
      map.set(key, { ...row, deleted_at: deletedAt, updated_at: deletedAt, synced_at: this.stamp() })
    }
  }

  async pullPage<T extends SyncTable>(
    table: T,
    after: PullCursor | null,
    limit: number,
  ): Promise<Array<PulledRow<T>>> {
    this.net()
    const page = [...this.tableMap(table).values()]
      .filter((row) => isAfterCursor({ synced_at: row.synced_at, id: row.id }, after))
      .sort((a, b) =>
        a.synced_at === b.synced_at
          ? a.id < b.id
            ? -1
            : 1
          : a.synced_at < b.synced_at
            ? -1
            : 1,
      )
      .slice(0, limit)
    return page as unknown as Array<PulledRow<T>>
  }

  async readBack<T extends SyncTable>(
    table: T,
    by: 'id' | 'date',
    values: readonly string[],
  ): Promise<Array<PulledRow<T>>> {
    this.net()
    const wanted = new Set(values)
    const rows = [...this.tableMap(table).values()].filter((row) => wanted.has(String(row[by])))
    return rows as unknown as Array<PulledRow<T>>
  }
}

/* ── Utilidades de test ───────────────────────────────────────────────────── */

let dbCounter = 0
const openDbs: HabitDb[] = []

function freshDb(): HabitDb {
  dbCounter += 1
  const db = new HabitDb(`test-sync-${dbCounter}`)
  openDbs.push(db)
  return db
}

afterEach(async () => {
  while (openDbs.length > 0) {
    const db = openDbs.pop()
    if (db !== undefined) await db.delete()
  }
})

let clock = 1_000_000
const nextNow = (): number => {
  clock += 1
  return clock
}

interface Rig {
  db: HabitDb
  backend: FakeBackend
  engine: SyncEngine
  seedCalls: number
}

function rig(options: { realSeed?: boolean } = {}): Rig {
  const db = freshDb()
  const backend = new FakeBackend()
  const state: Rig = { db, backend, engine: undefined as unknown as SyncEngine, seedCalls: 0 }
  state.engine = createSyncEngine({
    db,
    backend,
    now: nextNow,
    seed:
      options.realSeed === true
        ? ensureSeeded
        : async () => {
            state.seedCalls += 1
          },
  })
  return state
}

function habit(id: string, updatedAt: number, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    name: `Hábito ${id}`,
    type: 'check',
    weeklyTarget: 5,
    order: 0,
    createdOn: '2026-07-01',
    archivedAt: null,
    updatedAt,
    ...overrides,
  }
}

function remoteHabit(id: string, updatedAt: number, overrides: Partial<RemoteRowByTable['habits']> = {}): Record<string, unknown> {
  return {
    id,
    name: `Hábito ${id}`,
    type: 'check',
    target_minutes: null,
    weekly_target: 5,
    sort_order: 0,
    created_on: '2026-07-01',
    archived_at: null,
    updated_at: updatedAt,
    deleted_at: null,
    ...overrides,
  }
}

async function enqueue(db: HabitDb, table: SyncTable, rowId: string): Promise<void> {
  await db.outbox.add({ table, rowId, op: 'upsert' })
}

/* ── 1. Encolado transaccional desde los repositorios (base singleton) ────── */

describe('encolado en repositorios', () => {
  async function clearSingleton(): Promise<void> {
    await singletonDb.transaction(
      'rw',
      [...SYNC_TABLES.map((t) => singletonDb.table(t)), singletonDb.outbox, singletonDb.syncMeta],
      async () => {
        for (const table of SYNC_TABLES) await singletonDb.table(table).clear()
        await singletonDb.outbox.clear()
        await singletonDb.syncMeta.clear()
      },
    )
  }

  it('cada escritura deja su fila y su entrada de outbox, atómicamente', async () => {
    await clearSingleton()
    const created = await habitsRepo.createHabit({ name: 'Leer', type: 'counter', targetMinutes: 30 })
    await entriesRepo.toggleCheck(created.id, '2026-07-20')
    const range = await frozenRepo.createFrozenRange('2026-08-01', '2026-08-02')
    await frozenRepo.deleteFrozenRange(range.id)

    const outbox = await singletonDb.outbox.orderBy('seq').toArray()
    expect(outbox.map((e) => `${e.table}:${e.op}`)).toEqual([
      'habits:upsert',
      'entries:upsert',
      'frozenRanges:upsert',
      'frozenRanges:delete',
    ])
    const deletion = outbox[3]
    expect(deletion?.rowId).toBe(range.id)
    expect(deletion?.deletedAt).toBeTypeOf('number')
    await clearSingleton()
  })
})

/* ── 2-5. Subida ──────────────────────────────────────────────────────────── */

describe('subida (push)', () => {
  it('push feliz: filas en remoto, outbox vacío y sin error', async () => {
    const { db, backend, engine } = rig()
    await db.habits.put(habit('h1', 100))
    await db.entries.put({ id: 'e1', habitId: 'h1', date: '2026-07-20', done: true, updatedAt: 101 })
    await enqueue(db, 'habits', 'h1')
    await enqueue(db, 'entries', 'e1')

    await expect(engine.syncNow('push')).resolves.toBe(true)

    expect(backend.rowsOf('habits').map((r) => r.id)).toEqual(['h1'])
    expect(backend.rowsOf('entries').map((r) => r.id)).toEqual(['e1'])
    expect(await db.outbox.count()).toBe(0)
    expect(engine.getSnapshot().lastError).toBeNull()
    expect(engine.getSnapshot().lastSyncedAt).not.toBeNull()
  })

  it('coalescencia: tres ediciones = un solo upsert; upsert+delete = solo tombstone', async () => {
    const { db, backend, engine } = rig()
    await db.habits.put(habit('h1', 300))
    await enqueue(db, 'habits', 'h1')
    await enqueue(db, 'habits', 'h1')
    await enqueue(db, 'habits', 'h1')
    // rango creado y borrado antes de sincronizar: solo debe viajar el borrado
    await db.outbox.add({ table: 'frozenRanges', rowId: 'r1', op: 'upsert' })
    await db.outbox.add({ table: 'frozenRanges', rowId: 'r1', op: 'delete', deletedAt: 400 })

    await expect(engine.syncNow('push')).resolves.toBe(true)

    const habitBatches = backend.upsertBatches.filter((b) => b.table === 'habits')
    expect(habitBatches).toHaveLength(1)
    expect(habitBatches[0]?.rows).toHaveLength(1)
    expect(backend.upsertBatches.filter((b) => b.table === 'frozenRanges')).toHaveLength(0)
    expect(backend.deleteCalls).toEqual([{ table: 'frozenRanges', rowId: 'r1', deletedAt: 400 }])
    expect(await db.outbox.count()).toBe(0)
  })

  it('error de red: el outbox se conserva y el reintento lo vacía', async () => {
    const { db, backend, engine } = rig()
    await db.habits.put(habit('h1', 100))
    await enqueue(db, 'habits', 'h1')
    backend.failNext = 1

    await expect(engine.syncNow('push')).resolves.toBe(false)
    expect(engine.getSnapshot().lastError).toContain('red caída')
    expect(await db.outbox.count()).toBe(1)
    expect(backend.rowsOf('habits')).toHaveLength(0)

    await expect(engine.syncNow('push')).resolves.toBe(true)
    expect(backend.rowsOf('habits')).toHaveLength(1)
    expect(await db.outbox.count()).toBe(0)
    expect(engine.getSnapshot().lastError).toBeNull()
  })

  it('una edición durante el vuelo no se pierde: sobrevive al snapshot y sube después', async () => {
    const { db, backend, engine } = rig()
    await db.entries.put({ id: 'e1', habitId: 'h1', date: '2026-07-20', done: false, updatedAt: 100 })
    await enqueue(db, 'entries', 'e1')

    const { started, release } = backend.holdNextUpsert()
    const flight = engine.syncNow('push')
    await started
    // edición mientras la subida está en vuelo
    await db.entries.put({ id: 'e1', habitId: 'h1', date: '2026-07-20', done: true, updatedAt: 200 })
    await enqueue(db, 'entries', 'e1')
    release()
    await expect(flight).resolves.toBe(true)

    // pushAll drena: la versión final en remoto es la edición en vuelo
    const remote = backend.rowsOf('entries')
    expect(remote).toHaveLength(1)
    expect(remote[0]?.done).toBe(true)
    expect(remote[0]?.updated_at).toBe(200)
    expect(await db.outbox.count()).toBe(0)
    // y en local sigue la versión nueva (el eco viejo no la pisó)
    const local = await db.entries.get('e1')
    expect(local?.done).toBe(true)
  })
})

/* ── 6-8. Bajada ──────────────────────────────────────────────────────────── */

describe('bajada (pull)', () => {
  it('LWW en ambos sentidos: el remoto más nuevo se aplica, el local más nuevo se conserva', async () => {
    const { db, backend, engine } = rig()
    await db.habits.put(habit('viejo-local', 100, { name: 'Local viejo' }))
    await db.habits.put(habit('nuevo-local', 900, { name: 'Local nuevo' }))
    backend.seedRemote('habits', [
      remoteHabit('viejo-local', 500, { name: 'Remoto gana' }),
      remoteHabit('nuevo-local', 500, { name: 'Remoto pierde' }),
      remoteHabit('solo-remoto', 500, { name: 'Nuevo del otro lado' }),
    ])

    await expect(engine.syncNow('full')).resolves.toBe(true)

    expect((await db.habits.get('viejo-local'))?.name).toBe('Remoto gana')
    expect((await db.habits.get('nuevo-local'))?.name).toBe('Local nuevo')
    expect((await db.habits.get('solo-remoto'))?.name).toBe('Nuevo del otro lado')
  })

  it('un tombstone remoto borra la fila local (rango descongelado en el otro dispositivo)', async () => {
    const { db, backend, engine } = rig()
    const range: FrozenRange = { id: 'r1', startDate: '2026-08-01', endDate: '2026-08-05', updatedAt: 100 }
    await db.frozenRanges.put(range)
    backend.seedRemote('frozenRanges', [
      { id: 'r1', start_date: '2026-08-01', end_date: '2026-08-05', note: null, updated_at: 500, deleted_at: 500 },
    ])

    await expect(engine.syncNow('full')).resolves.toBe(true)
    expect(await db.frozenRanges.count()).toBe(0)
  })

  it('una edición local más nueva que el tombstone remoto se conserva (resurrección LWW)', async () => {
    const { db, backend, engine } = rig()
    await db.frozenRanges.put({ id: 'r1', startDate: '2026-08-01', endDate: '2026-08-09', updatedAt: 900 })
    backend.seedRemote('frozenRanges', [
      { id: 'r1', start_date: '2026-08-01', end_date: '2026-08-05', note: null, updated_at: 500, deleted_at: 500 },
    ])

    await expect(engine.syncNow('full')).resolves.toBe(true)
    expect((await db.frozenRanges.get('r1'))?.endDate).toBe('2026-08-09')
  })

  it('entries converge por clave lógica: mismo día con ids distintos no duplica', async () => {
    const { db, backend, engine } = rig()
    await db.entries.put({ id: 'id-local', habitId: 'h1', date: '2026-07-20', done: false, updatedAt: 100 })
    backend.seedRemote('entries', [
      {
        id: 'id-remoto',
        habit_id: 'h1',
        date: '2026-07-20',
        done: true,
        minutes: null,
        note: null,
        updated_at: 200,
        deleted_at: null,
      },
    ])

    await expect(engine.syncNow('full')).resolves.toBe(true)

    const all = await db.entries.toArray()
    expect(all).toHaveLength(1)
    expect(all[0]?.id).toBe('id-local') // conserva el id local: identidad = clave lógica
    expect(all[0]?.done).toBe(true) // pero adopta el contenido remoto más nuevo
  })
})

/* ── 9-10. Guardia del servidor, read-back y eco ─────────────────────────── */

describe('guardia del servidor y read-back', () => {
  it('un dispositivo rezagado no pisa el remoto y se corrige a sí mismo', async () => {
    const { db, backend, engine } = rig()
    backend.seedRemote('habits', [remoteHabit('h1', 500, { name: 'Versión buena' })])
    // copia local vieja con cambio pendiente (reloj atrasado)
    await db.habits.put(habit('h1', 100, { name: 'Versión rancia' }))
    await enqueue(db, 'habits', 'h1')

    await expect(engine.syncNow('push')).resolves.toBe(true)

    // el servidor conservó la buena…
    expect(backend.rowsOf('habits')[0]?.name).toBe('Versión buena')
    // …y el read-back corrigió la copia local del perdedor
    expect((await db.habits.get('h1'))?.name).toBe('Versión buena')
    expect(await db.outbox.count()).toBe(0)
  })

  it('el eco del propio push no cambia nada y el cursor avanza', async () => {
    const { db, engine } = rig()
    await db.habits.put(habit('h1', 100))
    await enqueue(db, 'habits', 'h1')
    await expect(engine.syncNow('push')).resolves.toBe(true)

    const before = await db.habits.get('h1')
    await expect(engine.syncNow('full')).resolves.toBe(true)

    expect(await db.habits.get('h1')).toEqual(before)
    const cursor = await db.syncMeta.get('cursor:habits')
    expect(cursor !== undefined && 'rowId' in cursor && cursor.rowId === 'h1').toBe(true)
  })
})

/* ── 11. Paginación keyset ────────────────────────────────────────────────── */

describe('paginación keyset', () => {
  it('grupos de synced_at idéntico cruzando el borde de página se aplican una vez, y un corte reanuda', async () => {
    const { db, backend, engine } = rig()
    // 800 filas normales + un grupo de 1200 con el MISMO synced_at (como un
    // batch de push real) que cruza el borde de la página de 1000, + 300 más.
    // Página 1 = 800 'a' + 200 'b' → el cursor queda EN MITAD del grupo
    // congelado y el desempate por id es imprescindible.
    const ids = (n: number, prefix: string): string[] =>
      Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(5, '0')}`)
    backend.seedRemote('habits', ids(800, 'a').map((id) => remoteHabit(id, 10)))
    backend.freezeStamp()
    backend.seedRemote('habits', ids(1200, 'b').map((id) => remoteHabit(id, 20)))
    backend.unfreezeStamp()
    backend.seedRemote('habits', ids(300, 'c').map((id) => remoteHabit(id, 30)))

    // Corte determinista: la primera página baja bien, la segunda llamada falla.
    backend.skipBeforeFail = 1
    backend.failNext = 1
    await expect(engine.syncNow('full')).resolves.toBe(false)
    expect(await db.habits.count()).toBe(1000) // página 1 aplicada y su cursor persistido

    // Reanudación: completa lo que falta sin duplicar ni saltarse nada.
    await expect(engine.syncNow('full')).resolves.toBe(true)
    expect(await db.habits.count()).toBe(2300)
    expect(await db.habits.get('b00000')).toBeDefined()
    expect(await db.habits.get('b01199')).toBeDefined()
    // la bajada aplica directo: nada se re-encola
    expect(await db.outbox.count()).toBe(0)
  })
})

/* ── 12. Siembra pospuesta ────────────────────────────────────────────────── */

describe('siembra pospuesta (initialSync)', () => {
  it('si la primera bajada trae hábitos, NO se siembra', async () => {
    const state = rig()
    state.backend.seedRemote('habits', [remoteHabit('h1', 100), remoteHabit('h2', 100)])

    await expect(state.engine.initialSync('user-1')).resolves.toBe(true)

    expect(state.seedCalls).toBe(0)
    expect(await state.db.habits.count()).toBe(2)
    const account = await state.db.syncMeta.get('account')
    expect(account !== undefined && 'userId' in account && account.userId === 'user-1').toBe(true)
    expect(await state.db.syncMeta.get('firstPull')).toBeDefined()
  })

  it('si la cuenta está vacía, siembra los 14, los encola y los sube', async () => {
    const { db, backend, engine } = rig({ realSeed: true })

    await expect(engine.initialSync('user-1')).resolves.toBe(true)

    expect(await db.habits.count()).toBe(14)
    expect(backend.rowsOf('habits')).toHaveLength(14)
    expect(await db.outbox.count()).toBe(0)
    expect(await db.syncMeta.get('firstPull')).toBeDefined()
  })

  it('en visitas posteriores no vuelve a sembrar aunque el usuario archive todo', async () => {
    const state = rig()
    await state.db.syncMeta.put({ id: 'firstPull', at: 1 })
    await state.db.syncMeta.put({ id: 'account', userId: 'user-1' })

    await expect(state.engine.initialSync('user-1')).resolves.toBe(true)
    expect(state.seedCalls).toBe(0)
    expect(await state.db.habits.count()).toBe(0)
  })
})

/* ── 13. Guardia de cambio de cuenta ─────────────────────────────────────── */

describe('guardia de cuenta', () => {
  it('otro usuario resetea cursores y re-encola todo lo local', async () => {
    const { db, backend, engine } = rig()
    await db.habits.put(habit('h1', 100))
    await db.syncMeta.put({ id: 'account', userId: 'user-viejo' })
    await db.syncMeta.put({ id: 'cursor:habits', syncedAt: '000000000099', rowId: 'zzz' })
    await db.syncMeta.put({ id: 'firstPull', at: 1 })

    await expect(engine.initialSync('user-nuevo')).resolves.toBe(true)

    // lo local se subió a la cuenta nueva
    expect(backend.rowsOf('habits').map((r) => r.id)).toEqual(['h1'])
    const account = await db.syncMeta.get('account')
    expect(account !== undefined && 'userId' in account && account.userId === 'user-nuevo').toBe(true)
    // y no se sembró nada: había datos locales
    expect(await db.habits.count()).toBe(1)
  })
})

/* ── 14. Migración v1 → v2 ────────────────────────────────────────────────── */

describe('migración Dexie v1 → v2', () => {
  it('encola como upsert todas las filas existentes de la Fase 1', async () => {
    const name = 'test-migracion-v1'
    const v1 = new Dexie(name)
    v1.version(1).stores({
      habits: 'id, order',
      entries: 'id, &[habitId+date], date, habitId',
      frozenRanges: 'id, startDate',
      plannerTasks: 'id, weekId',
      taskTemplates: 'id, weekday',
      settings: 'id',
    })
    await v1.open()
    const legacyHabit: Habit = habit('h1', 100)
    const legacyEntry: DayEntry = { id: 'e1', habitId: 'h1', date: '2026-07-20', done: true, updatedAt: 101 }
    await v1.table('habits').add(legacyHabit)
    await v1.table('entries').add(legacyEntry)
    v1.close()

    const migrated = new HabitDb(name)
    openDbs.push(migrated)
    await migrated.open()

    const outbox = await migrated.outbox.toArray()
    expect(outbox.map((e) => `${e.table}:${e.rowId}:${e.op}`).sort()).toEqual([
      'entries:e1:upsert',
      'habits:h1:upsert',
    ])
    // los datos siguen intactos
    expect(await migrated.habits.get('h1')).toEqual(legacyHabit)
    expect(await migrated.entries.get('e1')).toEqual(legacyEntry)
  })
})
