/*
 * Tests de las rachas. Semana fija de referencia:
 * hoy = '2026-07-23' (jueves) → semana ISO del lunes 20 al domingo 26.
 * La suite corre bajo TZ=America/New_York (vite.config.ts): zona hostil.
 */
import { describe, expect, it } from 'vitest'
import {
  computeGlobalStreak,
  computeHabitStreak,
  computeHabitWeeklyStreak,
  requiredForThreshold,
} from './streaks'
import { logicalDateOf } from './dates'
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

/** Registros done=true de un hábito en las fechas dadas. */
function doneOn(habitId: string, dates: IsoDate[]): DayEntry[] {
  return dates.map((date) => entry(habitId, date, true))
}

function habitStreak(input: {
  habit?: Habit
  entries?: DayEntry[]
  frozenRanges?: FrozenRange[]
  today?: IsoDate
}) {
  return computeHabitStreak({
    habit: input.habit ?? habit({ id: 'a' }),
    entries: input.entries ?? [],
    frozenRanges: input.frozenRanges ?? [],
    today: input.today ?? TODAY,
  })
}

function globalStreak(input: {
  habits?: Habit[]
  entries?: DayEntry[]
  frozenRanges?: FrozenRange[]
  today?: IsoDate
  threshold?: number
}) {
  return computeGlobalStreak({
    habits: input.habits ?? [],
    entries: input.entries ?? [],
    frozenRanges: input.frozenRanges ?? [],
    today: input.today ?? TODAY,
    threshold: input.threshold ?? 0.8,
  })
}

function weeklyStreak(input: {
  habit?: Habit
  entries?: DayEntry[]
  frozenRanges?: FrozenRange[]
  today?: IsoDate
}) {
  return computeHabitWeeklyStreak({
    habit: input.habit ?? habit({ id: 'a' }),
    entries: input.entries ?? [],
    frozenRanges: input.frozenRanges ?? [],
    today: input.today ?? TODAY,
  })
}

describe('computeHabitStreak — racha diaria estricta', () => {
  it('sin registros: todo a cero y sin aviso (no hay racha que perder)', () => {
    // Los días cerrados sin registrar son fallos, pero nunca hubo racha notable.
    expect(habitStreak({})).toEqual({ current: 0, record: 0, isRecord: false, recentlyBroken: null })
  })

  it('hoy cumplido suma: tres días seguidos hasta hoy son racha 3', () => {
    const result = habitStreak({ entries: doneOn('a', ['2026-07-21', '2026-07-22', TODAY]) })
    expect(result.current).toBe(3)
    expect(result.record).toBe(3)
    expect(result.isRecord).toBe(true)
  })

  it('hoy pendiente no rompe: la racha cierra en ayer', () => {
    expect(habitStreak({ entries: doneOn('a', ['2026-07-21', '2026-07-22']) }).current).toBe(2)
  })

  it('un fallo cerrado rompe y deja el aviso con longitud y fecha de la rotura', () => {
    const result = habitStreak({ entries: doneOn('a', ['2026-07-20', '2026-07-21']) })
    expect(result.current).toBe(0)
    expect(result.record).toBe(2)
    expect(result.recentlyBroken).toEqual({ length: 2, brokenOn: '2026-07-22' })
  })

  it('rearrancar la racha silencia el aviso', () => {
    const result = habitStreak({ entries: doneOn('a', ['2026-07-20', '2026-07-21', TODAY]) })
    expect(result.current).toBe(1)
    expect(result.recentlyBroken).toBeNull()
  })

  it('la racha cruza un rango congelado sin romperse', () => {
    const result = habitStreak({
      entries: doneOn('a', ['2026-07-18', '2026-07-19', '2026-07-22', TODAY]),
      frozenRanges: [range('2026-07-20', '2026-07-21')],
    })
    expect(result.current).toBe(4)
    expect(result.record).toBe(4)
  })

  it('hoy congelado: la racha cierra en ayer sin romperse', () => {
    const result = habitStreak({
      entries: doneOn('a', ['2026-07-20', '2026-07-21', '2026-07-22']),
      frozenRanges: [range(TODAY, TODAY)],
    })
    expect(result.current).toBe(3)
  })

  it('hábito creado hoy: cero sin marcar, uno (y récord) al marcar', () => {
    const created = habit({ id: 'a', createdOn: TODAY })
    expect(habitStreak({ habit: created })).toEqual({
      current: 0,
      record: 0,
      isRecord: false,
      recentlyBroken: null,
    })
    const marked = habitStreak({ habit: created, entries: doneOn('a', [TODAY]) })
    expect(marked).toEqual({ current: 1, record: 1, isRecord: true, recentlyBroken: null })
  })

  it('los registros anteriores a createdOn se ignoran (no suman ni son récord)', () => {
    const result = habitStreak({
      habit: habit({ id: 'a', createdOn: '2026-07-22' }),
      entries: doneOn('a', ['2026-07-18', '2026-07-19', '2026-07-20', '2026-07-22', TODAY]),
    })
    expect(result.current).toBe(2)
    expect(result.record).toBe(2)
  })

  it('el récord sobrevive a la ruptura', () => {
    const result = habitStreak({
      entries: doneOn('a', ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-07-22', TODAY]),
    })
    expect(result.current).toBe(2)
    expect(result.record).toBe(5)
    expect(result.isRecord).toBe(false)
  })

  it('superar el récord histórico lo actualiza y marca isRecord', () => {
    const june = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05']
    const july = ['2026-07-18', '2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22', TODAY]
    const result = habitStreak({ entries: doneOn('a', [...june, ...july]) })
    expect(result.current).toBe(6)
    expect(result.record).toBe(6)
    expect(result.isRecord).toBe(true)
  })

  it('empatar el récord histórico también es récord', () => {
    const june = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05']
    const july = ['2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22', TODAY]
    const result = habitStreak({ entries: doneOn('a', [...june, ...july]) })
    expect(result.current).toBe(5)
    expect(result.record).toBe(5)
    expect(result.isRecord).toBe(true)
  })

  it('ventana del aviso: a 7 días abiertos avisa, a 8 ya no', () => {
    // Rotura el 16: después quedan 7 días abiertos (17..23) → avisa.
    const at7 = habitStreak({ entries: doneOn('a', ['2026-07-14', '2026-07-15']) })
    expect(at7.recentlyBroken).toEqual({ length: 2, brokenOn: '2026-07-16' })
    // Rotura el 15: después quedan 8 días abiertos (16..23) → silencio.
    const at8 = habitStreak({ entries: doneOn('a', ['2026-07-13', '2026-07-14']) })
    expect(at8.recentlyBroken).toBeNull()
  })

  it('los días congelados no consumen la ventana del aviso', () => {
    // Rotura el lunes 13, semana entera congelada, hoy lunes 20: solo 1 día abierto
    // tras la rotura → avisa aunque hayan pasado 7 días naturales.
    const result = habitStreak({
      entries: doneOn('a', ['2026-07-11', '2026-07-12']),
      frozenRanges: [range('2026-07-14', '2026-07-19')],
      today: '2026-07-20',
    })
    expect(result.recentlyBroken).toEqual({ length: 2, brokenOn: '2026-07-13' })
  })

  it('perder una racha de un solo día no avisa', () => {
    const result = habitStreak({ entries: doneOn('a', ['2026-07-21']) })
    expect(result.current).toBe(0)
    expect(result.recentlyBroken).toBeNull()
  })

  it('una rotura trivial posterior no tapa la última rotura notable', () => {
    // Racha de 5 rota el 20; racha de 1 (día 21) rota el 22: avisa de la de 5.
    const result = habitStreak({
      entries: doneOn('a', ['2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-21']),
    })
    expect(result.recentlyBroken).toEqual({ length: 5, brokenOn: '2026-07-20' })
  })

  it('un contador a medias cuenta como fallo cerrado, pero hoy queda pendiente', () => {
    const counter = habit({ id: 'a', type: 'counter', targetMinutes: 30 })
    const closed = habitStreak({
      habit: counter,
      entries: [...doneOn('a', ['2026-07-20', '2026-07-21']), entry('a', '2026-07-22', false, { minutes: 18 })],
    })
    expect(closed.current).toBe(0)
    expect(closed.record).toBe(2)
    const pending = habitStreak({
      habit: counter,
      entries: [...doneOn('a', ['2026-07-21', '2026-07-22']), entry('a', TODAY, false, { minutes: 18 })],
    })
    expect(pending.current).toBe(2)
  })

  it('un hábito archivado calcula igual con su historial (y decae tras archivarse)', () => {
    const archived = habit({ id: 'a', archivedAt: 123 })
    const result = habitStreak({ habit: archived, entries: doneOn('a', ['2026-07-20', '2026-07-21']) })
    expect(result.current).toBe(0)
    expect(result.record).toBe(2)
  })

  it('los cambios de hora de Madrid no parten la racha (fechas ISO puras)', () => {
    const spring = habitStreak({
      entries: doneOn('a', ['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30']),
      today: '2026-03-30',
    })
    expect(spring.current).toBe(5)
    const autumn = habitStreak({
      entries: doneOn('a', ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']),
      today: '2026-10-27',
    })
    expect(autumn.current).toBe(5)
  })

  it('antes de las 4:00 el día lógico sigue siendo ayer y no rompe nada', () => {
    // 01:30 CEST del 24-jul → día lógico 23-jul; el 23 sin marcar queda pendiente.
    const today = logicalDateOf(new Date(Date.UTC(2026, 6, 23, 23, 30)))
    expect(today).toBe('2026-07-23')
    const result = habitStreak({ entries: doneOn('a', ['2026-07-21', '2026-07-22']), today })
    expect(result.current).toBe(2)
  })

  it('un rango congelado que cruza el cambio de mes no rompe la racha', () => {
    const result = habitStreak({
      entries: doneOn('a', ['2026-07-28', '2026-07-29', '2026-08-03', '2026-08-04']),
      frozenRanges: [range('2026-07-30', '2026-08-02')],
      today: '2026-08-04',
    })
    expect(result.current).toBe(4)
  })
})

describe('computeGlobalStreak — racha global por umbral', () => {
  /** n hábitos 'h1'..'hn' activos creados a principio de año. */
  function fleet(n: number): Habit[] {
    return Array.from({ length: n }, (_, i) => habit({ id: `h${i + 1}` }))
  }

  /** Registros done de los primeros `count` hábitos de la flota en una fecha. */
  function fleetDone(count: number, date: IsoDate): DayEntry[] {
    return Array.from({ length: count }, (_, i) => entry(`h${i + 1}`, date, true))
  }

  it('con el umbral por defecto, 12 de 14 pasa y 11 de 14 no', () => {
    const habits = fleet(14)
    expect(globalStreak({ habits, entries: fleetDone(12, TODAY) }).current).toBe(1)
    expect(globalStreak({ habits, entries: fleetDone(11, TODAY) }).current).toBe(0)
  })

  it('el empate exacto con el umbral cuenta (>=), también con divisiones no triviales', () => {
    expect(globalStreak({ habits: fleet(5), entries: fleetDone(4, TODAY) }).current).toBe(1) // 4/5 = 0.8
    expect(globalStreak({ habits: fleet(15), entries: fleetDone(12, TODAY) }).current).toBe(1) // 12/15 = 0.8
  })

  it('el umbral es configurable: 0.5 relaja y 1.0 exige el pleno', () => {
    const habits = fleet(4)
    expect(globalStreak({ habits, entries: fleetDone(2, TODAY), threshold: 0.5 }).current).toBe(1)
    expect(globalStreak({ habits, entries: fleetDone(1, TODAY), threshold: 0.5 }).current).toBe(0)
    expect(globalStreak({ habits: fleet(3), entries: fleetDone(3, TODAY), threshold: 1 }).current).toBe(1)
    expect(globalStreak({ habits: fleet(3), entries: fleetDone(2, TODAY), threshold: 1 }).current).toBe(0)
  })

  it('hoy pendiente no rompe la racha global; hoy sobre el umbral la extiende', () => {
    const habits = fleet(1)
    const pending = globalStreak({
      habits,
      entries: [...fleetDone(1, '2026-07-21'), ...fleetDone(1, '2026-07-22')],
    })
    expect(pending.current).toBe(2)
    const extended = globalStreak({
      habits,
      entries: [...fleetDone(1, '2026-07-22'), ...fleetDone(1, TODAY)],
    })
    expect(extended.current).toBe(2)
  })

  it('un día congelado se salta también en la racha global', () => {
    const habits = fleet(2)
    const result = globalStreak({
      habits,
      entries: [
        ...fleetDone(2, '2026-07-18'),
        ...fleetDone(2, '2026-07-19'),
        ...fleetDone(2, '2026-07-22'),
      ],
      frozenRanges: [range('2026-07-20', '2026-07-21')],
    })
    expect(result.current).toBe(3)
  })

  it('el denominador de cada día respeta el createdOn de cada hábito', () => {
    // b nace el 22: hasta entonces solo cuenta a (1/1 pasa); el 22 son 2 elegibles
    // y solo a cumple → 1/2 < 0.8 rompe. Hoy pendiente.
    const habits = [habit({ id: 'a' }), habit({ id: 'b', createdOn: '2026-07-22' })]
    const result = globalStreak({
      habits,
      entries: doneOn('a', ['2026-07-20', '2026-07-21', '2026-07-22']),
    })
    expect(result.current).toBe(0)
    expect(result.record).toBeGreaterThanOrEqual(2)
    expect(result.recentlyBroken?.brokenOn).toBe('2026-07-22')
  })

  it('los días previos al primer createdOn no existen para la racha', () => {
    const late = [habit({ id: 'a', createdOn: '2026-07-22' })]
    const result = globalStreak({ habits: late, entries: doneOn('a', ['2026-07-22', TODAY]) })
    expect(result.current).toBe(2)
    expect(result.record).toBe(2)
  })

  it('sin hábitos activos no hay racha global', () => {
    expect(globalStreak({ habits: [habit({ id: 'a', archivedAt: 5 })] })).toEqual({
      current: 0,
      record: 0,
      isRecord: false,
      recentlyBroken: null,
    })
  })

  it('archivar reescribe el pasado: un hábito siempre incumplido deja de lastrar', () => {
    const a = habit({ id: 'a' })
    const days: IsoDate[] = ['2026-07-20', '2026-07-21', '2026-07-22', TODAY]
    const entries = doneOn('a', days)
    const withDeadWeight = globalStreak({ habits: [a, habit({ id: 'b' })], entries })
    expect(withDeadWeight.current).toBe(0) // 1/2 = 0.5 < 0.8 todos los días
    const archived = globalStreak({ habits: [a, habit({ id: 'b', archivedAt: 9 })], entries })
    expect(archived.current).toBe(4) // 1/1 todos los días
  })

  it('un desarchivado reintroduce su hueco sin registros como fallo del día', () => {
    // b solo cumplió hoy: los días 20-22 quedan a 1/2 y rompen; hoy 2/2 pasa.
    const habits = [habit({ id: 'a' }), habit({ id: 'b' })]
    const result = globalStreak({
      habits,
      entries: [...doneOn('a', ['2026-07-20', '2026-07-21', '2026-07-22', TODAY]), ...doneOn('b', [TODAY])],
    })
    expect(result.current).toBe(1)
  })

  it('los registros de archivados o de ids desconocidos no inflan el numerador', () => {
    const result = globalStreak({
      habits: [habit({ id: 'a' }), habit({ id: 'c', archivedAt: 9 })],
      entries: [
        ...doneOn('a', ['2026-07-22', TODAY]),
        ...doneOn('c', ['2026-07-22', TODAY]),
        ...doneOn('ghost', ['2026-07-22', TODAY]),
      ],
    })
    expect(result.current).toBe(2) // solo cuenta a: 1/1
  })

  it('el récord global sobrevive a la ruptura y el aviso trae la racha perdida', () => {
    const days: IsoDate[] = ['2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19']
    const result = globalStreak({ habits: fleet(1), entries: doneOn('h1', days) })
    expect(result.current).toBe(0)
    expect(result.record).toBe(5)
    expect(result.recentlyBroken).toEqual({ length: 5, brokenOn: '2026-07-20' })
  })

  it('la racha global cruza el cambio de mes y de año', () => {
    const habits = [habit({ id: 'a', createdOn: '2025-12-01' })]
    const result = globalStreak({
      habits,
      entries: doneOn('a', ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']),
      today: '2026-01-02',
    })
    expect(result.current).toBe(4)
  })
})

describe('computeHabitWeeklyStreak — racha semanal contra el objetivo mínimo', () => {
  it('semanas cerradas logradas más la actual lograda: la racha las encadena', () => {
    const target3 = habit({ id: 'a', weeklyTarget: 3, createdOn: '2026-06-29' })
    const weeks = [
      ['2026-06-29', '2026-06-30', '2026-07-01'],
      ['2026-07-06', '2026-07-07', '2026-07-08'],
      ['2026-07-13', '2026-07-14', '2026-07-15'],
      ['2026-07-20', '2026-07-21', '2026-07-22'],
    ].flat() as IsoDate[]
    const result = weeklyStreak({ habit: target3, entries: doneOn('a', weeks) })
    expect(result.current).toBe(4)
    expect(result.currentWeek.status).toBe('achieved')
    expect(result.isRecord).toBe(true)
  })

  it('una semana cerrada por debajo del objetivo rompe; el récord conserva lo previo', () => {
    // Semana del 6-jul: 5/5. Semana del 13-jul: 3 días → rompe (5 exigidos).
    const entries = doneOn('a', [
      '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10',
      '2026-07-13', '2026-07-14', '2026-07-15',
    ])
    const result = weeklyStreak({ habit: habit({ id: 'a', createdOn: '2026-07-06' }), entries })
    expect(result.current).toBe(0)
    expect(result.record).toBe(1)
  })

  it("semana en curso 'pending': aún alcanzable, ni suma ni rompe", () => {
    // Jueves con 3 hechos: quedan hoy y 3 días → 3+4 >= 5.
    const result = weeklyStreak({ entries: doneOn('a', ['2026-07-20', '2026-07-21', '2026-07-22']) })
    expect(result.current).toBe(0)
    expect(result.currentWeek).toEqual({ status: 'pending', done: 3, effectiveTarget: 5 })
  })

  it("semana en curso 'lost' en cuanto es matemáticamente imposible", () => {
    // Jueves sin nada hecho: 0 + 4 jugables < 5.
    const result = weeklyStreak({})
    expect(result.current).toBe(0)
    expect(result.currentWeek.status).toBe('lost')
  })

  it("'lost' aunque hoy esté hecho, si ya no salen las cuentas", () => {
    const result = weeklyStreak({ entries: doneOn('a', [TODAY]) })
    expect(result.currentWeek).toEqual({ status: 'lost', done: 1, effectiveTarget: 5 })
    expect(result.current).toBe(0)
  })

  it('la semana de creación usa el objetivo efectivo: creado en viernes exige 3', () => {
    // Se mira desde el lunes siguiente (semana actual 'pending', que no interfiere).
    const friday = habit({ id: 'a', createdOn: '2026-07-17', weeklyTarget: 5 })
    const achieved = weeklyStreak({
      habit: friday,
      entries: doneOn('a', ['2026-07-17', '2026-07-18', '2026-07-19']),
      today: '2026-07-20',
    })
    expect(achieved.current).toBe(1)
    expect(achieved.currentWeek.status).toBe('pending')
    const missed = weeklyStreak({
      habit: friday,
      entries: doneOn('a', ['2026-07-17', '2026-07-18']),
      today: '2026-07-20',
    })
    expect(missed.current).toBe(0)
    expect(missed.record).toBe(0)
  })

  it('una semana parcialmente congelada reduce el objetivo efectivo', () => {
    // Lun-vie congelados: quedan 2 días elegibles → objetivo min(5, 2) = 2.
    const result = weeklyStreak({
      habit: habit({ id: 'a', createdOn: '2026-07-13' }),
      entries: doneOn('a', ['2026-07-18', '2026-07-19']),
      frozenRanges: [range('2026-07-13', '2026-07-17')],
      today: '2026-07-20',
    })
    expect(result.current).toBeGreaterThanOrEqual(1)
  })

  it('una semana ENTERA congelada se salta y las rachas de ambos lados se encadenan', () => {
    const target3 = habit({ id: 'a', weeklyTarget: 3, createdOn: '2026-07-06' })
    const result = weeklyStreak({
      habit: target3,
      entries: doneOn('a', ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-20', '2026-07-21', '2026-07-22']),
      frozenRanges: [range('2026-07-13', '2026-07-19')],
    })
    // Semana del 6: lograda (+1). Semana del 13: congelada (se salta, no marca
    // 'lograda' pese a min(target,0)=0). Semana actual: 3/3 lograda (+1).
    expect(result.current).toBe(2)
    expect(result.currentWeek.status).toBe('achieved')
  })

  it('objetivos borde: 7 de 7 exige el pleno; 1 de 7 se logra con hoy', () => {
    const daily = habit({ id: 'a', weeklyTarget: 7, createdOn: '2026-07-06' })
    const fullWeek = doneOn('a', [
      '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12',
    ])
    expect(weeklyStreak({ habit: daily, entries: fullWeek }).record).toBe(1)
    const easy = habit({ id: 'a', weeklyTarget: 1 })
    const result = weeklyStreak({ habit: easy, entries: doneOn('a', [TODAY]) })
    expect(result.current).toBe(1)
    expect(result.currentWeek.status).toBe('achieved')
  })

  it('una semana ISO que cruza el año natural cuenta una sola vez', () => {
    // 2026-W01 va del lunes 29-dic-2025 al domingo 4-ene-2026.
    const habit29 = habit({ id: 'a', createdOn: '2025-12-29', weeklyTarget: 5 })
    const result = weeklyStreak({
      habit: habit29,
      entries: doneOn('a', ['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']),
      today: '2026-01-08',
    })
    expect(result.current).toBe(0) // la semana actual (W02) va 'lost': 0 + jue-dom < 5
    expect(result.record).toBe(1) // la W01 partida entre años se logró una vez
  })

  it('el récord semanal sobrevive y el empate marca isRecord', () => {
    const target2 = habit({ id: 'a', weeklyTarget: 2, createdOn: '2026-06-15' })
    const entries = doneOn('a', [
      '2026-06-15', '2026-06-16', // semana 1 lograda
      '2026-06-22', '2026-06-23', // semana 2 lograda
      // semana del 29-jun: fallo
      '2026-07-06', '2026-07-07', // semana 4 lograda
      '2026-07-13', '2026-07-14', // semana 5 lograda
      '2026-07-20', '2026-07-21', // semana actual lograda
    ])
    const result = weeklyStreak({ habit: target2, entries })
    expect(result.current).toBe(3)
    expect(result.record).toBe(3)
    expect(result.isRecord).toBe(true)
  })
})

describe('requiredForThreshold', () => {
  it('coincide con la comparación real de la racha, flotantes incluidos', () => {
    expect(requiredForThreshold(0.8, 14)).toBe(12)
    expect(requiredForThreshold(0.8, 15)).toBe(12) // ceil(0.8·15) daría 13: mal
    expect(requiredForThreshold(0.8, 5)).toBe(4)
    expect(requiredForThreshold(0.5, 4)).toBe(2)
    expect(requiredForThreshold(1, 3)).toBe(3)
  })

  it('sin hábitos activos no exige nada', () => {
    expect(requiredForThreshold(0.8, 0)).toBe(0)
  })
})
