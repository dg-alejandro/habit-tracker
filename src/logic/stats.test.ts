/*
 * Tests del porcentaje semanal. Semana fija de referencia:
 * hoy = '2026-07-23' (jueves) → semana ISO del lunes 20 al domingo 26,
 * días transcurridos: 20, 21, 22 y 23 (cuatro).
 */
import { describe, expect, it } from 'vitest'
import { computeWeeklyPercentage, isCounterFulfilled } from './stats'
import type { DayEntry, FrozenRange, Habit, IsoDate } from '../data/types'

const TODAY: IsoDate = '2026-07-23'

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

function entry(habitId: string, date: IsoDate, done: boolean, extra: Partial<DayEntry> = {}): DayEntry {
  return { id: `${habitId}|${date}`, habitId, date, done, updatedAt: 0, ...extra }
}

function range(startDate: IsoDate, endDate: IsoDate): FrozenRange {
  return { id: `${startDate}..${endDate}`, startDate, endDate, updatedAt: 0 }
}

function pct(input: {
  habits?: Habit[]
  entries?: DayEntry[]
  frozenRanges?: FrozenRange[]
  today?: IsoDate
}): number | null {
  return computeWeeklyPercentage({
    habits: input.habits ?? [],
    entries: input.entries ?? [],
    frozenRanges: input.frozenRanges ?? [],
    today: input.today ?? TODAY,
  })
}

describe('isCounterFulfilled', () => {
  it('cumple exactamente al alcanzar el objetivo, no antes', () => {
    expect(isCounterFulfilled(29, 30)).toBe(false)
    expect(isCounterFulfilled(30, 30)).toBe(true)
    expect(isCounterFulfilled(45, 30)).toBe(true)
    expect(isCounterFulfilled(0, 30)).toBe(false)
  })

  it('sin objetivo válido nunca se cumple solo', () => {
    expect(isCounterFulfilled(120, 0)).toBe(false)
  })
})

describe('computeWeeklyPercentage', () => {
  it('sin hábitos no hay celdas: null (la UI muestra "—")', () => {
    expect(pct({})).toBeNull()
  })

  it('con hábitos pero sin registros es 0: sin registrar cuenta como no cumplido', () => {
    expect(pct({ habits: [habit({ id: 'a' })] })).toBe(0)
  })

  it('todo cumplido los días transcurridos es 100', () => {
    const days: IsoDate[] = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23']
    expect(
      pct({ habits: [habit({ id: 'a' })], entries: days.map((d) => entry('a', d, true)) }),
    ).toBe(100)
  })

  it('cumplimiento parcial: 4 de 8 celdas es 50', () => {
    expect(
      pct({
        habits: [habit({ id: 'a' }), habit({ id: 'b' })],
        entries: [
          entry('a', '2026-07-20', true),
          entry('a', '2026-07-21', true),
          entry('b', '2026-07-22', true),
          entry('b', '2026-07-23', true),
        ],
      }),
    ).toBe(50)
  })

  it('un contador a medias (done=false) no cumple', () => {
    expect(
      pct({
        habits: [habit({ id: 'a', type: 'counter', targetMinutes: 30 })],
        entries: [entry('a', '2026-07-23', false, { minutes: 18 })],
      }),
    ).toBe(0) // 0 de 4 celdas
  })

  it('un contador cumplido se cuenta por su done, sin recalcular minutos', () => {
    expect(
      pct({
        habits: [habit({ id: 'a', type: 'counter', targetMinutes: 30, createdOn: TODAY })],
        entries: [entry('a', TODAY, true, { minutes: 30 })],
      }),
    ).toBe(100)
  })

  it('un día congelado sale del numerador Y del denominador', () => {
    // 3 celdas abiertas (20, 22, 23); el registro cumplido del 21 se ignora.
    expect(
      pct({
        habits: [habit({ id: 'a' })],
        entries: [entry('a', '2026-07-20', true), entry('a', '2026-07-21', true)],
        frozenRanges: [range('2026-07-21', '2026-07-21')],
      }),
    ).toBe(33)
  })

  it('con todos los días transcurridos congelados no hay celdas: null, no 0', () => {
    expect(
      pct({
        habits: [habit({ id: 'a' })],
        entries: [entry('a', '2026-07-20', true)],
        frozenRanges: [range('2026-07-20', '2026-07-23')],
      }),
    ).toBeNull()
  })

  it('un hábito creado a mitad de semana solo aporta celdas desde su creación', () => {
    // Creado el miércoles 22: celdas 22 y 23; cumplido el 22 → 50.
    expect(
      pct({
        habits: [habit({ id: 'a', createdOn: '2026-07-22' })],
        entries: [entry('a', '2026-07-22', true)],
      }),
    ).toBe(50)
  })

  it('un hábito creado después de hoy no aporta celdas', () => {
    expect(pct({ habits: [habit({ id: 'a', createdOn: '2026-07-25' })] })).toBeNull()
  })

  it('los archivados no cuentan aunque vengan en la entrada', () => {
    const days: IsoDate[] = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23']
    expect(
      pct({
        habits: [habit({ id: 'a' }), habit({ id: 'b', archivedAt: 123 })],
        entries: days.map((d) => entry('a', d, true)),
      }),
    ).toBe(100)
  })

  it('redondea al entero más cercano: 1/3 → 33 y 2/3 → 67', () => {
    const frozenMonday = [range('2026-07-20', '2026-07-20')] // deja 3 celdas
    expect(
      pct({
        habits: [habit({ id: 'a' })],
        entries: [entry('a', '2026-07-22', true)],
        frozenRanges: frozenMonday,
      }),
    ).toBe(33)
    expect(
      pct({
        habits: [habit({ id: 'a' })],
        entries: [entry('a', '2026-07-22', true), entry('a', '2026-07-23', true)],
        frozenRanges: frozenMonday,
      }),
    ).toBe(67)
  })

  it('un lunes el denominador es solo el lunes', () => {
    expect(
      pct({
        habits: [habit({ id: 'a' })],
        entries: [entry('a', '2026-07-20', true)],
        today: '2026-07-20',
      }),
    ).toBe(100)
  })

  it('un domingo cuentan los siete días', () => {
    expect(
      pct({
        habits: [habit({ id: 'a' })],
        entries: [entry('a', '2026-07-20', true)],
        today: '2026-07-26',
      }),
    ).toBe(14) // 1 de 7
  })

  it('ignora registros de otras semanas aunque vengan en la entrada', () => {
    expect(
      pct({ habits: [habit({ id: 'a' })], entries: [entry('a', '2026-07-13', true)] }),
    ).toBe(0)
  })

  it('ignora registros de hábitos desconocidos', () => {
    expect(
      pct({ habits: [habit({ id: 'a' })], entries: [entry('fantasma', '2026-07-23', true)] }),
    ).toBe(0)
  })
})
