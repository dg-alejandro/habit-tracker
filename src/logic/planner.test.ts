/*
 * Tests del planificador (CLAUDE.md §4). Semana de referencia: '2026-W30',
 * del lunes 20 al domingo 26 de julio de 2026.
 * La suite corre bajo TZ=America/New_York (vite.config.ts): zona hostil.
 */
import { describe, expect, it } from 'vitest'
import {
  BLOCKS_PER_DAY,
  applyTaskMove,
  blockLabel,
  blockRangeLabel,
  blockToMinutes,
  countNightTasks,
  countPendingByDay,
  dropTargetId,
  durationLabel,
  bankDragId,
  groupTasksByDay,
  isFromBank,
  isValidBlock,
  isValidEstimatedMinutes,
  layoutDayTasks,
  parseBankDragId,
  parseDropTargetId,
  placementFor,
  planEphemeralPurge,
  sortTasksForDisplay,
  taskFromBank,
  unplacedTasks,
  taskMinutes,
  visibleMinutes,
} from './planner'
import type { IsoWeekday, PlannerTask, WeekId } from '../data/types'

const WEEK: WeekId = '2026-W30'

function task(overrides: Partial<PlannerTask> & Pick<PlannerTask, 'id'>): PlannerTask {
  return {
    text: overrides.id,
    weekId: WEEK,
    day: null,
    startBlock: null,
    done: false,
    templateId: null,
    carriedOverCount: 0,
    updatedAt: 0,
    ...overrides,
  }
}

/** Tarea que salio del banco. */
function fromBank(
  overrides: Partial<PlannerTask> & Pick<PlannerTask, 'id'>,
  bankId = `banco-${overrides.id}`,
): PlannerTask {
  return task({ ...overrides, templateId: bankId })
}

/** Tarea colocada en la rejilla: bloque de inicio y duración en minutos. */
function scheduled(id: string, startBlock: number, estimatedMinutes?: number): PlannerTask {
  const row = task({ id, day: 1, startBlock })
  if (estimatedMinutes !== undefined) row.estimatedMinutes = estimatedMinutes
  return row
}

describe('bloques ↔ minutos ↔ etiqueta', () => {
  it('el bloque se etiqueta con la hora en la que empieza', () => {
    expect(blockLabel(0)).toBe('00:00')
    expect(blockLabel(1)).toBe('00:30')
    expect(blockLabel(23)).toBe('11:30')
    expect(blockLabel(47)).toBe('23:30')
  })

  it('siempre dos dígitos con cero a la izquierda (es formato de dato, no de interfaz)', () => {
    for (let block = 0; block < BLOCKS_PER_DAY; block += 1) {
      expect(blockLabel(block)).toMatch(/^\d{2}:(00|30)$/)
    }
  })

  it('blockToMinutes cuenta los minutos desde medianoche', () => {
    expect(blockToMinutes(0)).toBe(0)
    expect(blockToMinutes(18)).toBe(540)
    expect(blockToMinutes(47)).toBe(1410)
  })

  it('isValidBlock acota a 0–47 (el esquema remoto lo exige)', () => {
    expect(isValidBlock(0)).toBe(true)
    expect(isValidBlock(47)).toBe(true)
    expect(isValidBlock(-1)).toBe(false)
    expect(isValidBlock(48)).toBe(false)
    expect(isValidBlock(3.5)).toBe(false)
  })
})

describe('duracion de una tarea', () => {
  it('la duracion NO se redondea al bloque: 20 minutos son 20 minutos', () => {
    // La rejilla marca a que hora EMPIEZA; cuanto dura es un numero suyo.
    expect(taskMinutes(20)).toBe(20)
    expect(taskMinutes(45)).toBe(45)
    expect(taskMinutes(90)).toBe(90)
  })

  it('sin duracion estimada se le supone un bloque', () => {
    expect(taskMinutes(undefined)).toBe(30)
  })

  it('duraciones absurdas no rompen la rejilla', () => {
    expect(taskMinutes(0)).toBe(30)
    expect(taskMinutes(-30)).toBe(30)
    expect(taskMinutes(60 * 40)).toBe(BLOCKS_PER_DAY * 30)
  })

  it('visibleMinutes recorta a medianoche sin mover la hora de inicio', () => {
    // Una tarea de 3 h a las 23:00 se guarda tal cual y se pinta hasta las 24:00.
    expect(visibleMinutes(46, 180)).toBe(60)
    expect(visibleMinutes(47, 180)).toBe(30)
    expect(visibleMinutes(18, 90)).toBe(90)
    expect(visibleMinutes(18, 20)).toBe(20)
  })

  it('blockRangeLabel devuelve null si la tarea no está colocada', () => {
    expect(blockRangeLabel(null, 90)).toBeNull()
  })

  it('blockRangeLabel dice la hora de fin REAL, no la del bloque redondeado', () => {
    expect(blockRangeLabel(18, 90)).toBe('09:00–10:30')
    expect(blockRangeLabel(18, 20)).toBe('09:00–09:20')
    expect(blockRangeLabel(18, 45)).toBe('09:00–09:45')
    expect(blockRangeLabel(20)).toBe('10:00–10:30')
    expect(blockRangeLabel(46, 180)).toBe('23:00–24:00')
  })

  it('la duración tiene tope: sin él, un número disparatado atascaría la subida', () => {
    // La columna remota es `integer`; un desbordamiento dejaría la cola parada.
    expect(isValidEstimatedMinutes(30)).toBe(true)
    expect(isValidEstimatedMinutes(24 * 60)).toBe(true)
    expect(isValidEstimatedMinutes(24 * 60 + 1)).toBe(false)
    expect(isValidEstimatedMinutes(999999999999)).toBe(false)
    expect(isValidEstimatedMinutes(0)).toBe(false)
    expect(isValidEstimatedMinutes(Number.NaN)).toBe(false)
  })

  it('durationLabel se lee en español y desaparece si no hay estimación', () => {
    expect(durationLabel(30)).toBe('30 min')
    expect(durationLabel(60)).toBe('1 h')
    expect(durationLabel(90)).toBe('1 h 30')
    expect(durationLabel(undefined)).toBeNull()
    expect(durationLabel(0)).toBeNull()
  })
})

describe('banco de tareas', () => {
  it('la ficha del banco se arrastra con un identificador propio', () => {
    // Asi el drop distingue «coloca esta tarea» de «saca una copia del banco».
    expect(bankDragId('abc')).toBe('bank:abc')
    expect(parseBankDragId('bank:abc')).toBe('abc')
    expect(parseBankDragId('una-tarea-cualquiera')).toBeNull()
  })

  it('sacar del banco produce una tarea colocada en su hueco', () => {
    const draft = taskFromBank(
      { id: 'gym', text: 'Gimnasio', estimatedMinutes: 60 },
      '2026-W30',
      4,
      38,
    )
    expect(draft).toEqual({
      text: 'Gimnasio',
      weekId: '2026-W30',
      day: 4,
      startBlock: 38,
      estimatedMinutes: 60,
      done: false,
      templateId: 'gym',
      carriedOverCount: 0,
    })
  })

  it('sin duracion en la ficha, la propiedad NO existe en la tarea (no es null)', () => {
    const draft = taskFromBank({ id: 'gym', text: 'Gimnasio' }, '2026-W30', 4, 38)
    expect('estimatedMinutes' in draft).toBe(false)
  })

  it('la tarea recuerda de que ficha salio, y eso es lo que la pinta distinta', () => {
    expect(isFromBank(fromBank({ id: 'a' }))).toBe(true)
    expect(isFromBank(task({ id: 'a' }))).toBe(false)
  })

  it('tambien se puede sacar del banco sin colocar', () => {
    const draft = taskFromBank({ id: 'gym', text: 'Gimnasio' }, '2026-W30', null, null)
    expect(draft.day).toBeNull()
    expect(draft.startBlock).toBeNull()
  })
})

describe('planEphemeralPurge — las puntuales solo viven su semana', () => {
  const CURRENT: WeekId = '2026-W31'

  it('borra lo puntual que quedó sin hacer en semanas anteriores', () => {
    expect(planEphemeralPurge({ staleTasks: [task({ id: 'a' })], currentWeek: CURRENT })).toEqual([
      'a',
    ])
  })

  it('NO borra lo que sí hiciste: eso es historial', () => {
    const stale = task({ id: 'a', done: true })
    expect(planEphemeralPurge({ staleTasks: [stale], currentWeek: CURRENT })).toEqual([])
  })

  it('NO borra lo que salio del banco, ni sin hacer', () => {
    // Se queda como registro de que ese jueves no fuiste al gimnasio.
    const stale = fromBank({ id: 'gym' })
    expect(planEphemeralPurge({ staleTasks: [stale], currentWeek: CURRENT })).toEqual([])
  })

  it('no toca la semana en curso ni las futuras', () => {
    const own = task({ id: 'a', weekId: CURRENT })
    const future = task({ id: 'b', weekId: '2026-W40' })
    expect(planEphemeralPurge({ staleTasks: [own, future], currentWeek: CURRENT })).toEqual([])
  })

  it('es idempotente: borrado el lote, no queda nada que borrar', () => {
    expect(planEphemeralPurge({ staleTasks: [task({ id: 'a' })], currentWeek: CURRENT })).toEqual([
      'a',
    ])
    expect(planEphemeralPurge({ staleTasks: [], currentWeek: CURRENT })).toEqual([])
  })
})

describe('layoutDayTasks — carriles de la cuadrícula', () => {
  it('una sola tarea ocupa todo el ancho', () => {
    const result = layoutDayTasks([scheduled('a', 20, 60)])
    expect(result).toHaveLength(1)
    expect(result[0]?.lane).toBe(0)
    expect(result[0]?.lanes).toBe(1)
    expect(result[0]?.minutes).toBe(60)
  })

  it('dos que no se solapan comparten carril y ancho completo', () => {
    const result = layoutDayTasks([scheduled('a', 20, 30), scheduled('b', 24, 30)])
    expect(result.map((placement) => placement.lane)).toEqual([0, 0])
    expect(result.map((placement) => placement.lanes)).toEqual([1, 1])
  })

  it('dos solapadas se reparten en dos carriles a media anchura', () => {
    const result = layoutDayTasks([scheduled('a', 20, 60), scheduled('b', 21, 60)])
    expect(result.map((placement) => placement.lane)).toEqual([0, 1])
    expect(result.map((placement) => placement.lanes)).toEqual([2, 2])
  })

  it('tres a la misma hora se reparten en tres carriles', () => {
    const result = layoutDayTasks([
      scheduled('a', 20, 60),
      scheduled('b', 20, 60),
      scheduled('c', 20, 60),
    ])
    expect(result.map((placement) => placement.lanes)).toEqual([3, 3, 3])
    expect(new Set(result.map((placement) => placement.lane)).size).toBe(3)
  })

  it('en una cadena A–B–C, A y C reutilizan carril y las tres comparten ancho', () => {
    // A(20–22) solapa con B(21–23), que solapa con C(22–24): un solo grupo conexo.
    const result = layoutDayTasks([
      scheduled('a', 20, 60),
      scheduled('b', 21, 60),
      scheduled('c', 22, 60),
    ])
    expect(result.map((placement) => placement.task.id)).toEqual(['a', 'b', 'c'])
    expect(result.map((placement) => placement.lane)).toEqual([0, 1, 0])
    expect(result.map((placement) => placement.lanes)).toEqual([2, 2, 2])
  })

  it('un hueco cierra el grupo: el ancho no se contagia entre grupos', () => {
    const result = layoutDayTasks([
      scheduled('a', 20, 60),
      scheduled('b', 21, 60),
      scheduled('z', 40, 30),
    ])
    expect(result.map((placement) => placement.lanes)).toEqual([2, 2, 1])
  })

  it('ignora las tareas sin colocar', () => {
    expect(layoutDayTasks([task({ id: 'a' })])).toEqual([])
  })

  it('las completadas también se colocan: siguen visibles y tachadas', () => {
    const result = layoutDayTasks([
      scheduled('a', 20, 30),
      { ...scheduled('b', 30, 30), done: true },
    ])
    expect(result).toHaveLength(2)
  })

  it('una tarea que desborda medianoche se pinta recortada', () => {
    expect(layoutDayTasks([scheduled('a', 46, 180)])[0]?.minutes).toBe(60)
  })

  it('dos tareas cortas seguidas NO se pisan: el solape se mide en minutos', () => {
    // 09:00–09:20 y 09:30–09:50 caben en el mismo carril.
    const result = layoutDayTasks([scheduled('a', 18, 20), scheduled('b', 19, 20)])
    expect(result.map((placement) => placement.lane)).toEqual([0, 0])
    expect(result.map((placement) => placement.lanes)).toEqual([1, 1])
  })

  it('es determinista con la entrada desordenada', () => {
    const tasks = [scheduled('c', 22, 60), scheduled('a', 20, 60), scheduled('b', 21, 60)]
    const forward = layoutDayTasks(tasks).map((placement) => [placement.task.id, placement.lane])
    const backward = layoutDayTasks([...tasks].reverse()).map((placement) => [
      placement.task.id,
      placement.lane,
    ])
    expect(forward).toEqual(backward)
  })
})

describe('franja nocturna', () => {
  it('cuenta las tareas que empiezan de madrugada', () => {
    expect(countNightTasks([scheduled('a', 4, 30), scheduled('b', 20, 30)])).toBe(1)
  })

  it('las 05:30 siguen siendo madrugada; las 06:00 ya no', () => {
    expect(countNightTasks([scheduled('a', 11, 60)])).toBe(1)
    expect(countNightTasks([scheduled('a', 12, 60)])).toBe(0)
  })

  it('las tareas sin colocar nunca cuentan como nocturnas', () => {
    expect(countNightTasks([task({ id: 'a' })])).toBe(0)
  })
})

describe('reparto para la pantalla', () => {
  it('groupTasksByDay reparte las colocadas y deja fuera las sueltas', () => {
    const byDay = groupTasksByDay([
      scheduled('a', 20),
      task({ id: 'b', day: 5, startBlock: 30 }),
      task({ id: 'suelta' }),
    ])
    expect([...byDay.keys()].sort()).toEqual([1, 5])
  })

  it('unplacedTasks recoge justo las que aún no están colocadas', () => {
    const result = unplacedTasks([
      scheduled('colocada', 20),
      task({ id: 'suelta' }),
      task({ id: 'hecha', done: true }),
    ])
    // Ordenadas para mostrar: lo pendiente antes que lo hecho.
    expect(result.map((row) => row.id)).toEqual(['suelta', 'hecha'])
  })

  it('countPendingByDay no cuenta las completadas', () => {
    const byDay = groupTasksByDay([
      scheduled('a', 20),
      { ...scheduled('b', 30), done: true },
    ])
    expect(countPendingByDay(byDay).get(1)).toBe(1)
  })

  it('applyTaskMove superpone el movimiento sin mutar la entrada', () => {
    const tasks = [task({ id: 'a' })]
    const moved = applyTaskMove(tasks, { id: 'a', day: 3, startBlock: 20 })
    expect(moved[0]?.day).toBe(3)
    expect(moved[0]?.startBlock).toBe(20)
    expect(tasks[0]?.day).toBeNull()
  })

  it('applyTaskMove también sabe descolocar', () => {
    const tasks = [scheduled('a', 20)]
    const moved = applyTaskMove(tasks, { id: 'a', day: null, startBlock: null })
    expect(moved[0]?.day).toBeNull()
  })
})

describe('sortTasksForDisplay — el orden de la caja', () => {
  it('las pendientes van antes que las hechas', () => {
    const result = sortTasksForDisplay([task({ id: 'a', done: true }), task({ id: 'b' })])
    expect(result.map((row) => row.id)).toEqual(['b', 'a'])
  })

  it('a igualdad de todo, alfabético en español', () => {
    const result = sortTasksForDisplay([
      task({ id: '1', text: 'Zapatos' }),
      task({ id: '2', text: 'Ánimo' }),
    ])
    expect(result.map((row) => row.text)).toEqual(['Ánimo', 'Zapatos'])
  })

  it('no muta el array de entrada', () => {
    const tasks = [task({ id: 'a', done: true }), task({ id: 'b' })]
    sortTasksForDisplay(tasks)
    expect(tasks.map((row) => row.id)).toEqual(['a', 'b'])
  })
})

describe('zonas de soltado', () => {
  it('ida y vuelta de los dos tipos de zona', () => {
    const targets = [
      { kind: 'unplaced' } as const,
      { kind: 'slot', day: 3 as IsoWeekday, block: 20 } as const,
    ]
    for (const target of targets) {
      expect(parseDropTargetId(dropTargetId(target))).toEqual(target)
    }
  })

  it('los identificadores son los esperados', () => {
    expect(dropTargetId({ kind: 'unplaced' })).toBe('unplaced')
    expect(dropTargetId({ kind: 'slot', day: 3, block: 20 })).toBe('slot:3:20')
  })

  it('placementFor traduce la zona a día y hora', () => {
    expect(placementFor({ kind: 'unplaced' })).toEqual({ day: null, startBlock: null })
    expect(placementFor({ kind: 'slot', day: 3, block: 20 })).toEqual({ day: 3, startBlock: 20 })
  })

  it('un id inválido devuelve null en vez de una zona inventada', () => {
    // 'day:3' era una zona del planificador anterior: ya no coloca nada.
    for (const id of [
      'inbox',
      'day:3',
      'slot:0:20',
      'slot:8:20',
      'slot:3:48',
      'slot:x:1',
      'slot:3',
      '',
      'otro',
    ]) {
      expect(parseDropTargetId(id)).toBeNull()
    }
  })

  it('acepta los bordes válidos: día 1 y 7, bloques 0 y 47', () => {
    expect(parseDropTargetId('slot:1:0')).toEqual({ kind: 'slot', day: 1, block: 0 })
    expect(parseDropTargetId('slot:7:47')).toEqual({ kind: 'slot', day: 7, block: 47 })
  })
})
