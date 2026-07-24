/*
 * Tests de la E/S del respaldo sobre Dexie real (fake-indexeddb): el export
 * estampa lastExportAt dentro de la propia copia; el import reemplaza todo,
 * bumpea updatedAt, re-encola íntegro y resetea los cursores.
 */
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from './db'
import { exportBackup, importBackup } from './backup'
import { buildBackup, type BackupData } from '../logic/backup'
import { SYNC_TABLES, type Habit } from './types'

async function clearAll(): Promise<void> {
  await db.transaction(
    'rw',
    [...SYNC_TABLES.map((t) => db.table(t)), db.outbox, db.syncMeta],
    async () => {
      for (const table of SYNC_TABLES) await db.table(table).clear()
      await db.outbox.clear()
      await db.syncMeta.clear()
    },
  )
}

function habit(id: string, updatedAt: number): Habit {
  return {
    id,
    name: `Hábito ${id}`,
    type: 'check',
    weeklyTarget: 5,
    order: 0,
    createdOn: '2026-07-01',
    archivedAt: null,
    updatedAt,
  }
}

function backupData(overrides: Partial<BackupData> = {}): BackupData {
  return {
    habits: [],
    entries: [],
    frozenRanges: [],
    plannerTasks: [],
    taskTemplates: [],
    settings: [],
    ...overrides,
  }
}

describe('exportBackup', () => {
  it('estampa lastExportAt y la propia copia lo lleva dentro', async () => {
    await clearAll()
    await db.habits.put(habit('h1', 100))

    const before = Date.now()
    const file = await exportBackup()

    expect(file.data.habits).toHaveLength(1)
    expect(file.data.settings).toHaveLength(1)
    const settingsRow = file.data.settings[0]
    expect(settingsRow?.lastExportAt).not.toBeNull()
    expect(settingsRow?.lastExportAt ?? 0).toBeGreaterThanOrEqual(before)
    // y quedó estampado también en local (con su encolado para sincronizar)
    const local = await db.settings.get('settings')
    expect(local?.lastExportAt).toBe(settingsRow?.lastExportAt)
    const queued = await db.outbox.toArray()
    expect(queued.some((e) => e.table === 'settings' && e.rowId === 'settings')).toBe(true)
    await clearAll()
  })
})

describe('importBackup', () => {
  it('reemplaza todo, bumpea updatedAt, re-encola íntegro y resetea cursores', async () => {
    await clearAll()
    // estado previo del dispositivo: datos, cola sucia y cursores avanzados
    await db.habits.put(habit('viejo', 900))
    await db.entries.put({ id: 'e-viejo', habitId: 'viejo', date: '2026-07-01', done: true, updatedAt: 900 })
    await db.outbox.add({ table: 'habits', rowId: 'viejo', op: 'upsert' })
    await db.syncMeta.put({ id: 'cursor:habits', syncedAt: '000000000010', rowId: 'x' })
    await db.syncMeta.put({ id: 'account', userId: 'user-1' })
    await db.syncMeta.put({ id: 'firstPull', at: 1 })

    const file = buildBackup(
      backupData({
        habits: [habit('restaurado', 5)],
        entries: [
          { id: 'e-rest', habitId: 'restaurado', date: '2026-07-02', done: false, updatedAt: 5 },
        ],
      }),
      123,
    )
    const before = Date.now()
    await importBackup(file)

    // reemplazo total con updatedAt bumpeado: la restauración gana por LWW
    const habits = await db.habits.toArray()
    expect(habits.map((h) => h.id)).toEqual(['restaurado'])
    expect(habits[0]?.updatedAt ?? 0).toBeGreaterThanOrEqual(before)
    expect(await db.entries.count()).toBe(1)

    // outbox: solo lo re-encolado (la cola vieja se descarta)
    const outbox = await db.outbox.toArray()
    expect(outbox.map((e) => `${e.table}:${e.rowId}`).sort()).toEqual([
      'entries:e-rest',
      'habits:restaurado',
    ])

    // cursores a cero; la cuenta y la marca de primera bajada se conservan
    expect(await db.syncMeta.get('cursor:habits')).toBeUndefined()
    expect(await db.syncMeta.get('account')).toBeDefined()
    expect(await db.syncMeta.get('firstPull')).toBeDefined()
    await clearAll()
  })
})
