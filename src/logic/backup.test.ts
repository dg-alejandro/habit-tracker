/*
 * Tests del respaldo JSON: aviso de exportación pendiente (con el corte de las
 * 4:00 y la TZ hostil del runner) y validación estructural del import.
 */
import { describe, expect, it } from 'vitest'
import { buildBackup, shouldRemindExport, validateBackup, type BackupData } from './backup'
import type { Habit } from '../data/types'

function habit(overrides: Partial<Habit> & Pick<Habit, 'id'>): Habit {
  return {
    name: overrides.id,
    type: 'check',
    weeklyTarget: 5,
    order: 0,
    createdOn: '2026-01-01',
    archivedAt: null,
    updatedAt: 0,
    ...overrides,
  }
}

function data(overrides: Partial<BackupData> = {}): BackupData {
  return {
    habits: [habit({ id: 'h1' })],
    entries: [{ id: 'e1', habitId: 'h1', date: '2026-07-20', done: true, updatedAt: 1 }],
    frozenRanges: [{ id: 'r1', startDate: '2026-08-01', endDate: '2026-08-02', updatedAt: 1 }],
    plannerTasks: [],
    taskTemplates: [],
    settings: [
      { id: 'settings', globalThreshold: 0.8, notificationTime: null, lastExportAt: null, updatedAt: 1 },
    ],
    ...overrides,
  }
}

describe('shouldRemindExport', () => {
  // Mediodía en Madrid (verano, UTC+2): día lógico inequívoco.
  const EXPORT_JUNE_1 = Date.UTC(2026, 5, 1, 10, 0, 0) // 2026-06-01 12:00 Madrid

  it('sin exportación y sin hábitos no hay nada que respaldar', () => {
    expect(shouldRemindExport(null, null, '2026-07-23')).toBe(false)
  })

  it('sin exportación cuenta desde el hábito más antiguo', () => {
    expect(shouldRemindExport(null, '2026-06-01', '2026-07-01')).toBe(false) // día 30 justo
    expect(shouldRemindExport(null, '2026-06-01', '2026-07-02')).toBe(true) // día 31
  })

  it('frontera exacta: a los 30 días no avisa, a los 31 sí', () => {
    expect(shouldRemindExport(EXPORT_JUNE_1, null, '2026-07-01')).toBe(false)
    expect(shouldRemindExport(EXPORT_JUNE_1, null, '2026-07-02')).toBe(true)
  })

  it('exportación reciente apaga el aviso aunque el hábito sea viejo', () => {
    expect(shouldRemindExport(EXPORT_JUNE_1, '2026-01-01', '2026-06-20')).toBe(false)
  })

  it('el corte de las 4:00 asigna la exportación de madrugada al día anterior', () => {
    // 02:30 en Madrid del 2 de junio (00:30 UTC) → día lógico 2026-06-01.
    const smallHours = Date.UTC(2026, 5, 2, 0, 30, 0)
    expect(shouldRemindExport(smallHours, null, '2026-07-01')).toBe(false)
    expect(shouldRemindExport(smallHours, null, '2026-07-02')).toBe(true)
  })
})

describe('buildBackup', () => {
  it('construye el sobre con app, versión y fecha', () => {
    const file = buildBackup(data(), 1234)
    expect(file.app).toBe('habit-tracker')
    expect(file.formatVersion).toBe(1)
    expect(file.exportedAt).toBe(1234)
    expect(file.data.habits).toHaveLength(1)
  })
})

describe('validateBackup', () => {
  it('acepta un respaldo construido por buildBackup (ida/vuelta por JSON)', () => {
    const file = buildBackup(data(), 99)
    const parsed: unknown = JSON.parse(JSON.stringify(file))
    const result = validateBackup(parsed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.file.data.entries).toHaveLength(1)
  })

  it('rechaza lo que no es un objeto o no es de esta app', () => {
    expect(validateBackup('texto')).toEqual({ ok: false, reason: 'El archivo no es un objeto JSON.' })
    const ajeno = { ...buildBackup(data(), 1), app: 'otra-app' }
    const result = validateBackup(ajeno)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('no es una copia')
  })

  it('rechaza una versión de formato desconocida', () => {
    const futuro = { ...buildBackup(data(), 1), formatVersion: 2 }
    const result = validateBackup(futuro)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('Versión de formato')
  })

  it('rechaza si falta una tabla', () => {
    const file = buildBackup(data(), 1)
    const sinTabla: unknown = JSON.parse(JSON.stringify(file))
    delete (sinTabla as { data: Record<string, unknown> }).data.frozenRanges
    const result = validateBackup(sinTabla)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('frozenRanges')
  })

  it('rechaza una fila malformada señalando tabla y posición', () => {
    const file = buildBackup(
      data({ habits: [habit({ id: 'h1' }), { malo: true } as unknown as Habit] }),
      1,
    )
    const result = validateBackup(JSON.parse(JSON.stringify(file)))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('habits')
      expect(result.reason).toContain('2')
    }
  })

  it('rechaza un tipo de hábito desconocido', () => {
    const raro = habit({ id: 'h1' })
    ;(raro as { type: string }).type = 'slider'
    const result = validateBackup(JSON.parse(JSON.stringify(buildBackup(data({ habits: [raro] }), 1))))
    expect(result.ok).toBe(false)
  })
})
