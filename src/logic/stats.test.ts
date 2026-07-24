/*
 * Tests del porcentaje semanal. Semana fija de referencia:
 * hoy = '2026-07-23' (jueves) → semana ISO del lunes 20 al domingo 26,
 * días transcurridos: 20, 21, 22 y 23 (cuatro).
 */
import { describe, expect, it } from 'vitest'
import {
  cellsPercentage,
  computeGlobalHeatmap,
  computeHabitHeatmap,
  computeMonthlySeries,
  computeWeeklyPercentage,
  computeWeeklySeries,
  computeYearlySeries,
  countCompletionCells,
  isCounterFulfilled,
} from './stats'
import { isoWeekDaysOf } from './dates'
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

describe('countCompletionCells — el núcleo compartido de celdas', () => {
  it('computeWeeklyPercentage y el núcleo dan lo mismo (misma función debajo)', () => {
    const scenarios = [
      {
        habits: [habit({ id: 'a' }), habit({ id: 'b', createdOn: '2026-07-22' })],
        entries: [entry('a', '2026-07-20', true), entry('a', '2026-07-22', true), entry('b', '2026-07-23', true)],
        frozenRanges: [] as FrozenRange[],
      },
      {
        habits: [habit({ id: 'a' })],
        entries: [entry('a', '2026-07-20', true), entry('a', '2026-07-21', true)],
        frozenRanges: [range('2026-07-21', '2026-07-21')],
      },
      {
        habits: [habit({ id: 'a' }), habit({ id: 'z', archivedAt: 9 })],
        entries: [entry('a', '2026-07-23', true), entry('z', '2026-07-23', true)],
        frozenRanges: [] as FrozenRange[],
      },
    ]
    for (const scenario of scenarios) {
      const viaCore = cellsPercentage(
        countCompletionCells({
          habits: scenario.habits.filter((h) => h.archivedAt === null),
          entries: scenario.entries,
          frozenRanges: scenario.frozenRanges,
          days: isoWeekDaysOf(TODAY).filter((d) => d <= TODAY),
        }),
      )
      expect(computeWeeklyPercentage({ ...scenario, today: TODAY })).toBe(viaCore)
    }
  })

  it('el núcleo NO filtra archivados: esa política es del caller', () => {
    const result = countCompletionCells({
      habits: [habit({ id: 'z', archivedAt: 9 })],
      entries: [entry('z', '2026-07-23', true)],
      frozenRanges: [],
      days: ['2026-07-23'],
    })
    expect(result).toEqual({ cells: 1, fulfilled: 1 })
  })
})

describe('computeWeeklySeries', () => {
  const base = {
    habits: [habit({ id: 'a' })],
    entries: [] as DayEntry[],
    frozenRanges: [] as FrozenRange[],
    today: TODAY,
  }

  it('devuelve 12 semanas cronológicas con sus ids ISO', () => {
    const points = computeWeeklySeries(base)
    expect(points).toHaveLength(12)
    expect(points[0]?.id).toBe('2026-W19')
    expect(points[11]?.id).toBe('2026-W30')
    expect(points[11]?.label).toBe('S30')
  })

  it('el punto de la semana actual coincide con computeWeeklyPercentage', () => {
    const input = {
      ...base,
      entries: [entry('a', '2026-07-20', true), entry('a', '2026-07-22', true)],
    }
    const points = computeWeeklySeries(input)
    expect(points[11]?.percentage).toBe(computeWeeklyPercentage(input))
    expect(points[11]?.percentage).toBe(50)
  })

  it('una semana totalmente congelada o anterior a la creación vale null', () => {
    const points = computeWeeklySeries({
      ...base,
      habits: [habit({ id: 'a', createdOn: '2026-07-13' })],
      frozenRanges: [range('2026-07-13', '2026-07-19')],
    })
    expect(points[9]?.id).toBe('2026-W28')
    expect(points[9]?.percentage).toBeNull() // anterior a la creación
    expect(points[10]?.percentage).toBeNull() // semana congelada entera
    expect(points[11]?.percentage).toBe(0) // semana actual abierta sin registros
  })
})

describe('computeMonthlySeries', () => {
  it('devuelve 12 meses cruzando el año, con el actual parcial', () => {
    const july = Array.from({ length: 23 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`)
    const points = computeMonthlySeries({
      habits: [habit({ id: 'a' })],
      entries: july.map((d) => entry('a', d, true)),
      frozenRanges: [],
      today: TODAY,
    })
    expect(points).toHaveLength(12)
    expect(points[0]?.id).toBe('2025-08')
    expect(points[11]?.id).toBe('2026-07')
    expect(points[11]?.percentage).toBe(100) // 23 de 23 días transcurridos
    expect(points[10]?.percentage).toBe(0) // junio completo sin registros
  })

  it('los meses anteriores a la creación del hábito valen null', () => {
    const points = computeMonthlySeries({
      habits: [habit({ id: 'a', createdOn: '2026-07-01' })],
      entries: [],
      frozenRanges: [],
      today: TODAY,
    })
    expect(points[10]?.percentage).toBeNull() // junio: sin celdas
    expect(points[11]?.percentage).toBe(0)
  })
})

describe('computeYearlySeries', () => {
  it('cubre desde el año del primer createdOn hasta el actual', () => {
    const points = computeYearlySeries({
      habits: [habit({ id: 'a', createdOn: '2025-06-01' })],
      entries: [entry('a', '2025-06-01', true)],
      frozenRanges: [],
      today: TODAY,
    })
    expect(points.map((p) => p.id)).toEqual(['2025', '2026'])
    // 1 cumplido de 214 celdas redondea a 0, pero el año TIENE celdas: no es null.
    expect(points[0]?.percentage).toBe(0)
    expect(points[1]?.percentage).not.toBeNull()
  })

  it('sin hábitos devuelve vacío', () => {
    expect(
      computeYearlySeries({ habits: [], entries: [], frozenRanges: [], today: TODAY }),
    ).toEqual([])
  })

  it('las series de un hábito archivado devuelven su historial, no null', () => {
    const archived = habit({ id: 'z', archivedAt: 9, createdOn: '2026-07-01' })
    const points = computeYearlySeries({
      habits: [archived],
      entries: [entry('z', '2026-07-01', true)],
      frozenRanges: [],
      today: TODAY,
    })
    expect(points[0]?.percentage).toBeGreaterThan(0)
  })
})

describe('computeGlobalHeatmap', () => {
  function fleet(n: number): Habit[] {
    return Array.from({ length: n }, (_, i) => habit({ id: `h${i + 1}` }))
  }

  function levelOn(done: number, threshold: number): number | null {
    const entries = Array.from({ length: done }, (_, i) => entry(`h${i + 1}`, TODAY, true))
    const days = computeGlobalHeatmap({
      habits: fleet(20),
      entries,
      frozenRanges: [],
      today: TODAY,
      threshold,
      year: 2026,
    })
    return days.find((d) => d.date === TODAY)?.level ?? null
  }

  it('niveles exactos con el umbral por defecto', () => {
    expect(levelOn(0, 0.8)).toBe(0)
    expect(levelOn(4, 0.8)).toBe(1) // 0.20
    expect(levelOn(5, 0.8)).toBe(2) // 0.25
    expect(levelOn(10, 0.8)).toBe(3) // 0.50
    expect(levelOn(15, 0.8)).toBe(3) // 0.75
    expect(levelOn(16, 0.8)).toBe(4) // 0.80: día logrado
    expect(levelOn(20, 0.8)).toBe(4)
  })

  it('el nivel 4 sigue al umbral configurable sin dejar rangos vacíos', () => {
    expect(levelOn(9, 0.4)).toBe(4) // 0.45 >= 0.4
    expect(levelOn(7, 0.4)).toBe(2) // 0.35: por debajo del umbral, tramo [0.25, 0.5)
  })

  it('statuses: no-eligible antes del primer hábito, frozen (incluso futuro), future', () => {
    const days = computeGlobalHeatmap({
      habits: [habit({ id: 'a', createdOn: '2026-03-01' })],
      entries: [],
      frozenRanges: [range('2026-07-10', '2026-07-12'), range('2026-09-01', '2026-09-05')],
      today: TODAY,
      threshold: 0.8,
      year: 2026,
    })
    const byDate = new Map(days.map((d) => [d.date, d]))
    expect(byDate.get('2026-02-15')?.status).toBe('no-eligible')
    expect(byDate.get('2026-07-11')?.status).toBe('frozen')
    expect(byDate.get('2026-07-11')?.level).toBeNull()
    expect(byDate.get('2026-08-15')?.status).toBe('future')
    expect(byDate.get('2026-09-03')?.status).toBe('frozen') // congelado por adelantado
    expect(byDate.get('2026-04-10')?.status).toBe('open')
    expect(byDate.get('2026-04-10')?.level).toBe(0)
  })

  it('un rango congelado que cruza el mes pinta frozen a ambos lados', () => {
    const days = computeGlobalHeatmap({
      habits: [habit({ id: 'a' })],
      entries: [],
      frozenRanges: [range('2026-06-28', '2026-07-02')],
      today: TODAY,
      threshold: 0.8,
      year: 2026,
    })
    const byDate = new Map(days.map((d) => [d.date, d]))
    expect(byDate.get('2026-06-30')?.status).toBe('frozen')
    expect(byDate.get('2026-07-01')?.status).toBe('frozen')
    expect(byDate.get('2026-07-03')?.status).toBe('open')
  })

  it('un año bisiesto tiene 366 celdas', () => {
    expect(
      computeGlobalHeatmap({
        habits: [habit({ id: 'a' })],
        entries: [],
        frozenRanges: [],
        today: TODAY,
        threshold: 0.8,
        year: 2028,
      }),
    ).toHaveLength(366)
  })
})

describe('computeHabitHeatmap', () => {
  it('los siete estados, con sus precedencias', () => {
    const counter = habit({ id: 'a', type: 'counter', targetMinutes: 30, createdOn: '2026-07-10' })
    const days = computeHabitHeatmap({
      habit: counter,
      entries: [
        entry('a', '2026-07-15', true, { minutes: 35 }),
        entry('a', '2026-07-16', false, { minutes: 18 }),
      ],
      frozenRanges: [range('2026-07-01', '2026-07-12'), range('2026-08-01', '2026-08-05')],
      today: TODAY,
      year: 2026,
    })
    const byDate = new Map(days.map((d) => [d.date, d]))
    expect(byDate.get('2026-07-05')?.status).toBe('before-creation') // gana a frozen
    expect(byDate.get('2026-07-11')?.status).toBe('frozen')
    expect(byDate.get('2026-07-15')).toEqual({ date: '2026-07-15', status: 'done', minutes: 35 })
    expect(byDate.get('2026-07-16')).toEqual({ date: '2026-07-16', status: 'partial', minutes: 18 })
    expect(byDate.get('2026-07-17')?.status).toBe('failed')
    expect(byDate.get(TODAY)?.status).toBe('pending') // hoy vacío nunca es fallo
    expect(byDate.get('2026-07-24')?.status).toBe('future')
    expect(byDate.get('2026-08-03')?.status).toBe('frozen') // frozen gana a future
  })
})
