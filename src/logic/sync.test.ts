/*
 * Tests de la lógica pura de sincronización: mapeos ida/vuelta, resolución
 * de conflictos por última escritura y cursor keyset.
 */
import { describe, expect, it } from 'vitest'
import {
  CODECS,
  chunk,
  isAfterCursor,
  nextCursor,
  remoteTableName,
  resolveLww,
  sameRow,
} from './sync'
import type {
  DayEntry,
  FrozenRange,
  Habit,
  PlannerTask,
  Settings,
  TaskTemplate,
} from '../data/types'

describe('remoteTableName', () => {
  it('traduce camelCase a snake_case', () => {
    expect(remoteTableName('habits')).toBe('habits')
    expect(remoteTableName('frozenRanges')).toBe('frozen_ranges')
    expect(remoteTableName('plannerTasks')).toBe('planner_tasks')
    expect(remoteTableName('taskTemplates')).toBe('task_templates')
  })
})

describe('mapeos ida/vuelta', () => {
  it('hábito completo (contador) conserva todos los campos', () => {
    const habit: Habit = {
      id: 'h1',
      name: 'Leer',
      type: 'counter',
      targetMinutes: 30,
      weeklyTarget: 5,
      order: 3,
      createdOn: '2026-07-01',
      archivedAt: 123,
      updatedAt: 456,
    }
    const remote = CODECS.habits.toRemote(habit)
    expect(remote.sort_order).toBe(3)
    expect(remote.target_minutes).toBe(30)
    expect(remote.deleted_at).toBeNull()
    expect(CODECS.habits.fromRemote(remote)).toEqual(habit)
  })

  it('hábito casilla: targetMinutes ausente sube como null y vuelve OMITIDO', () => {
    const habit: Habit = {
      id: 'h2',
      name: 'Gimnasio',
      type: 'check',
      weeklyTarget: 5,
      order: 0,
      createdOn: '2026-07-01',
      archivedAt: null,
      updatedAt: 1,
    }
    const remote = CODECS.habits.toRemote(habit)
    expect(remote.target_minutes).toBeNull()
    const back = CODECS.habits.fromRemote(remote)
    expect(back).toEqual(habit)
    expect('targetMinutes' in back).toBe(false)
  })

  it('registro con y sin opcionales', () => {
    const full: DayEntry = {
      id: 'e1',
      habitId: 'h1',
      date: '2026-07-20',
      done: true,
      minutes: 45,
      note: 'ventas',
      updatedAt: 9,
    }
    const bare: DayEntry = { id: 'e2', habitId: 'h2', date: '2026-07-20', done: false, updatedAt: 8 }
    expect(CODECS.entries.fromRemote(CODECS.entries.toRemote(full))).toEqual(full)
    const bareBack = CODECS.entries.fromRemote(CODECS.entries.toRemote(bare))
    expect(bareBack).toEqual(bare)
    expect('minutes' in bareBack).toBe(false)
    expect('note' in bareBack).toBe(false)
  })

  it('rango congelado, tarea, plantilla y ajustes', () => {
    const range: FrozenRange = {
      id: 'r1',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
      note: 'vacaciones',
      updatedAt: 2,
    }
    const task: PlannerTask = {
      id: 't1',
      text: 'Llamar al banco',
      weekId: '2026-W31',
      day: null,
      startBlock: null,
      done: false,
      templateId: null,
      carriedOverCount: 2,
      updatedAt: 3,
    }
    const template: TaskTemplate = {
      id: 'p1',
      text: 'Repaso semanal',
      weekday: 7,
      startBlock: 40,
      estimatedMinutes: 60,
      updatedAt: 4,
    }
    const settings: Settings = {
      id: 'settings',
      globalThreshold: 0.8,
      notificationTime: null,
      lastExportAt: null,
      updatedAt: 5,
    }
    expect(CODECS.frozenRanges.fromRemote(CODECS.frozenRanges.toRemote(range))).toEqual(range)
    expect(CODECS.plannerTasks.fromRemote(CODECS.plannerTasks.toRemote(task))).toEqual(task)
    expect(CODECS.taskTemplates.fromRemote(CODECS.taskTemplates.toRemote(template))).toEqual(template)
    expect(CODECS.settings.fromRemote(CODECS.settings.toRemote(settings))).toEqual(settings)
  })
})

describe('resolveLww', () => {
  it('gana el más nuevo; el empate manda al servidor; sin local gana el remoto', () => {
    expect(resolveLww(100, 200)).toBe('remote')
    expect(resolveLww(200, 100)).toBe('local')
    expect(resolveLww(100, 100)).toBe('remote')
    expect(resolveLww(null, 1)).toBe('remote')
  })
})

describe('sameRow', () => {
  it('iguala filas idénticas e ignora claves con undefined', () => {
    expect(sameRow({ a: 1, b: 'x' }, { b: 'x', a: 1 })).toBe(true)
    expect(sameRow({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(sameRow({ a: 1 }, { a: 2 })).toBe(false)
    expect(sameRow({ a: 1 }, { a: 1, c: 3 })).toBe(false)
    expect(sameRow({ a: null }, { a: null })).toBe(true)
    expect(sameRow({ a: null }, {})).toBe(false)
  })
})

describe('cursor keyset', () => {
  const rows = [
    { synced_at: '2026-07-24T10:00:00.000+00:00', id: 'a' },
    { synced_at: '2026-07-24T10:00:00.000+00:00', id: 'b' },
    { synced_at: '2026-07-24T10:00:01.000+00:00', id: 'a' },
  ]

  it('nextCursor apunta a la última fila; página vacía → null', () => {
    expect(nextCursor(rows)).toEqual({ syncedAt: '2026-07-24T10:00:01.000+00:00', rowId: 'a' })
    expect(nextCursor([])).toBeNull()
  })

  it('isAfterCursor respeta el orden (synced_at, id), con desempate por id', () => {
    const cursor = { syncedAt: '2026-07-24T10:00:00.000+00:00', rowId: 'a' }
    expect(isAfterCursor(rows[0]!, cursor)).toBe(false) // la misma fila del cursor
    expect(isAfterCursor(rows[1]!, cursor)).toBe(true) // mismo synced_at, id mayor
    expect(isAfterCursor(rows[2]!, cursor)).toBe(true) // synced_at mayor
    expect(isAfterCursor(rows[0]!, null)).toBe(true) // sin cursor: todo pasa
  })
})

describe('chunk', () => {
  it('trocea en lotes de tamaño fijo con resto', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 500)).toEqual([])
  })
})
