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
  blockSpan,
  blockToMinutes,
  countNightTasks,
  countPendingByDay,
  dropTargetId,
  durationLabel,
  fixedTaskEntryId,
  generateWeekTasks,
  generatedTaskId,
  groupFixedTasks,
  groupTasksByDay,
  isValidBlock,
  isValidEstimatedMinutes,
  layoutDayTasks,
  parseDropTargetId,
  parseFixedTaskGroupId,
  planEphemeralPurge,
  scheduledTasksByDay,
  sortTasksForDisplay,
  visibleSpan,
} from './planner'
import type { IsoWeekday, PlannerTask, TaskTemplate, WeekId } from '../data/types'

const WEEK: WeekId = '2026-W30'

function task(overrides: Partial<PlannerTask> & Pick<PlannerTask, 'id'>): PlannerTask {
  return {
    text: overrides.id,
    weekId: WEEK,
    day: 1,
    startBlock: null,
    done: false,
    templateId: null,
    carriedOverCount: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function template(overrides: Partial<TaskTemplate> & Pick<TaskTemplate, 'id'>): TaskTemplate {
  return {
    text: overrides.id,
    weekday: 1,
    startBlock: null,
    updatedAt: 0,
    ...overrides,
  }
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

describe('duración de una tarea en bloques', () => {
  it('sin duración estimada ocupa un bloque: marca su hora de inicio', () => {
    expect(blockSpan(undefined)).toBe(1)
  })

  it('redondea al alza al siguiente bloque de 30 min', () => {
    expect(blockSpan(30)).toBe(1)
    expect(blockSpan(45)).toBe(2)
    expect(blockSpan(60)).toBe(2)
    expect(blockSpan(90)).toBe(3)
  })

  it('duraciones absurdas no rompen la rejilla', () => {
    expect(blockSpan(0)).toBe(1)
    expect(blockSpan(-30)).toBe(1)
    expect(blockSpan(60 * 40)).toBe(BLOCKS_PER_DAY)
  })

  it('visibleSpan recorta a medianoche sin mover la hora de inicio', () => {
    // Una tarea de 3 h a las 23:00 se guarda tal cual y se pinta hasta las 24:00.
    expect(visibleSpan(46, 180)).toBe(2)
    expect(visibleSpan(47, 180)).toBe(1)
    expect(visibleSpan(18, 90)).toBe(3)
  })

  it('blockRangeLabel devuelve null sin hora asignada', () => {
    expect(blockRangeLabel(null, 90)).toBeNull()
  })

  it('blockRangeLabel etiqueta el tramo, con 24:00 como final del día', () => {
    expect(blockRangeLabel(18, 90)).toBe('09:00–10:30')
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

describe('tareas fijas — una ficha, varios días, una hora por día', () => {
  it('ida y vuelta del identificador de grupo', () => {
    const id = fixedTaskEntryId('gimnasio', 4)
    expect(id).toBe('grp:gimnasio:4')
    expect(parseFixedTaskGroupId(id)).toBe('gimnasio')
  })

  it('el grupo va en el id, así que renombrar la tarea no rompe la agrupación', () => {
    const group = 'abc-123'
    const templates = [
      template({ id: fixedTaskEntryId(group, 4), text: 'Gimnasio', weekday: 4, startBlock: 38 }),
      template({ id: fixedTaskEntryId(group, 6), text: 'GIMNASIO', weekday: 6, startBlock: 22 }),
    ]
    expect(groupFixedTasks(templates)).toHaveLength(1)
  })

  it('junta los días de una misma tarea, cada uno con su hora', () => {
    const group = 'g1'
    const [fixed] = groupFixedTasks([
      template({ id: fixedTaskEntryId(group, 6), text: 'Gimnasio', weekday: 6, startBlock: 22 }),
      template({ id: fixedTaskEntryId(group, 4), text: 'Gimnasio', weekday: 4, startBlock: 38 }),
    ])
    expect(fixed?.text).toBe('Gimnasio')
    // Ordenados de lunes a domingo, aunque entren al revés.
    expect(fixed?.days).toEqual([
      { weekday: 4, startBlock: 38 },
      { weekday: 6, startBlock: 22 },
    ])
  })

  it('un día puede no tener hora: los horarios varían y no se obliga a ponerla', () => {
    const [fixed] = groupFixedTasks([
      template({ id: fixedTaskEntryId('g1', 7), text: 'Gimnasio', weekday: 7, startBlock: null }),
    ])
    expect(fixed?.days[0]?.startBlock).toBeNull()
  })

  it('una fila sin grupo en el id forma su propia ficha: nada del planificador viejo se pierde', () => {
    const fixed = groupFixedTasks([
      template({ id: 'uuid-antiguo', text: 'Compra', weekday: 6 }),
      template({ id: fixedTaskEntryId('g1', 4), text: 'Gimnasio', weekday: 4 }),
    ])
    expect(fixed.map((row) => row.text)).toEqual(['Compra', 'Gimnasio'])
    expect(fixed[0]?.groupId).toBe('uuid-antiguo')
  })

  it('un id que no cumple el formato no cuenta como grupo', () => {
    expect(parseFixedTaskGroupId('grp:g1:8')).toBeNull()
    expect(parseFixedTaskGroupId('grp:g1')).toBeNull()
    expect(parseFixedTaskGroupId('uuid-suelto')).toBeNull()
  })

  it('las fichas salen por orden alfabético', () => {
    const fixed = groupFixedTasks([
      template({ id: fixedTaskEntryId('b', 1), text: 'Zumba' }),
      template({ id: fixedTaskEntryId('a', 1), text: 'Ábaco' }),
    ])
    expect(fixed.map((row) => row.text)).toEqual(['Ábaco', 'Zumba'])
  })
})

describe('generatedTaskId — la clave de la convergencia', () => {
  it('es determinista entre llamadas', () => {
    expect(generatedTaskId('t1', WEEK)).toBe(generatedTaskId('t1', WEEK))
  })

  it('cambia con la ficha y con la semana', () => {
    expect(generatedTaskId('t1', WEEK)).not.toBe(generatedTaskId('t2', WEEK))
    expect(generatedTaskId('t1', WEEK)).not.toBe(generatedTaskId('t1', '2026-W31'))
  })

  it('lleva prefijo, así que no puede colisionar con el uuid de una tarea breve', () => {
    expect(generatedTaskId('t1', WEEK).startsWith('tpl:')).toBe(true)
  })
})

describe('generateWeekTasks — materialización de la semana', () => {
  it('cada día de una tarea fija genera su tarea, con su hora y su duración', () => {
    const group = 'g1'
    const result = generateWeekTasks({
      templates: [
        template({
          id: fixedTaskEntryId(group, 4),
          text: 'Gimnasio',
          weekday: 4,
          startBlock: 38,
          estimatedMinutes: 60,
        }),
        template({ id: fixedTaskEntryId(group, 6), text: 'Gimnasio', weekday: 6, startBlock: 22 }),
      ],
      weekId: WEEK,
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'tpl:grp:g1:4:2026-W30',
      text: 'Gimnasio',
      weekId: WEEK,
      day: 4,
      startBlock: 38,
      estimatedMinutes: 60,
      done: false,
      templateId: 'grp:g1:4',
      carriedOverCount: 0,
    })
    expect(result[1]?.day).toBe(6)
    expect(result[1]?.startBlock).toBe(22)
  })

  it('sin tareas fijas no genera nada', () => {
    expect(generateWeekTasks({ templates: [], weekId: WEEK })).toEqual([])
  })

  it('un día sin hora aterriza en la lista del día, no en la cuadrícula', () => {
    const [generated] = generateWeekTasks({
      templates: [template({ id: 't1', weekday: 6, startBlock: null })],
      weekId: WEEK,
    })
    expect(generated?.day).toBe(6)
    expect(generated?.startBlock).toBeNull()
  })

  it('sin duración, la propiedad estimatedMinutes NO existe (no es null)', () => {
    const [generated] = generateWeekTasks({ templates: [template({ id: 't1' })], weekId: WEEK })
    expect(generated === undefined ? true : 'estimatedMinutes' in generated).toBe(false)
  })

  it('el orden de salida es estable e independiente del orden de entrada', () => {
    const templates = [
      template({ id: 'c', text: 'Cena', weekday: 5, startBlock: 42 }),
      template({ id: 'a', text: 'Ana', weekday: 1, startBlock: 20 }),
      template({ id: 'b', text: 'Bici', weekday: 1, startBlock: null }),
    ]
    const forward = generateWeekTasks({ templates, weekId: WEEK }).map((row) => row.id)
    const backward = generateWeekTasks({ templates: [...templates].reverse(), weekId: WEEK }).map(
      (row) => row.id,
    )
    expect(forward).toEqual(backward)
    // Día 1 antes que día 5; dentro del día, la que tiene hora antes que la que no.
    expect(forward).toEqual(['tpl:a:2026-W30', 'tpl:b:2026-W30', 'tpl:c:2026-W30'])
  })
})

describe('planEphemeralPurge — las breves solo viven su semana', () => {
  const CURRENT: WeekId = '2026-W31'

  it('borra lo breve que quedó sin hacer en semanas anteriores', () => {
    const stale = task({ id: 'a', weekId: WEEK })
    expect(planEphemeralPurge({ staleTasks: [stale], currentWeek: CURRENT })).toEqual(['a'])
  })

  it('NO borra lo que sí hiciste: eso es historial', () => {
    const stale = task({ id: 'a', weekId: WEEK, done: true })
    expect(planEphemeralPurge({ staleTasks: [stale], currentWeek: CURRENT })).toEqual([])
  })

  it('NO borra las generadas por una tarea fija, ni sin hacer', () => {
    // Se quedan como registro de que ese jueves no fuiste al gimnasio.
    const stale = task({ id: 'a', weekId: WEEK, templateId: 'grp:g1:4' })
    expect(planEphemeralPurge({ staleTasks: [stale], currentWeek: CURRENT })).toEqual([])
  })

  it('no toca la semana en curso ni las futuras', () => {
    const own = task({ id: 'a', weekId: CURRENT })
    const future = task({ id: 'b', weekId: '2026-W40' })
    expect(planEphemeralPurge({ staleTasks: [own, future], currentWeek: CURRENT })).toEqual([])
  })

  it('es idempotente: borrado el lote, no queda nada que borrar', () => {
    const stale = task({ id: 'a', weekId: WEEK })
    const ids = planEphemeralPurge({ staleTasks: [stale], currentWeek: CURRENT })
    expect(ids).toEqual(['a'])
    expect(planEphemeralPurge({ staleTasks: [], currentWeek: CURRENT })).toEqual([])
  })

  it('sin nada viejo no borra nada', () => {
    expect(planEphemeralPurge({ staleTasks: [], currentWeek: CURRENT })).toEqual([])
  })
})

describe('layoutDayTasks — carriles de la cuadrícula', () => {
  it('una sola tarea ocupa todo el ancho', () => {
    const result = layoutDayTasks([scheduled('a', 20, 60)])
    expect(result).toHaveLength(1)
    expect(result[0]?.lane).toBe(0)
    expect(result[0]?.lanes).toBe(1)
    expect(result[0]?.span).toBe(2)
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

  it('ignora las tareas sin hora: esas viven en la lista del día', () => {
    expect(layoutDayTasks([task({ id: 'a', day: 1, startBlock: null })])).toEqual([])
  })

  it('las completadas también se colocan: siguen visibles y tachadas', () => {
    const result = layoutDayTasks([
      scheduled('a', 20, 30),
      { ...scheduled('b', 30, 30), done: true },
    ])
    expect(result).toHaveLength(2)
  })

  it('una tarea que desborda medianoche se pinta recortada', () => {
    expect(layoutDayTasks([scheduled('a', 46, 180)])[0]?.span).toBe(2)
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

  it('las tareas sin hora nunca cuentan como nocturnas', () => {
    expect(countNightTasks([task({ id: 'a', startBlock: null })])).toBe(0)
  })
})

describe('agrupación por día para la pantalla', () => {
  it('groupTasksByDay reparte por día', () => {
    const byDay = groupTasksByDay([task({ id: 'a', day: 3 }), task({ id: 'b', day: 5 })])
    expect([...byDay.keys()].sort()).toEqual([3, 5])
  })

  it('scheduledTasksByDay separa las que tienen hora de las que no', () => {
    const byDay = groupTasksByDay([scheduled('a', 20), task({ id: 'b', day: 1 })])
    expect(scheduledTasksByDay(byDay).get(1)?.map((row) => row.id)).toEqual(['a'])
  })

  it('countPendingByDay no cuenta las completadas', () => {
    const byDay = groupTasksByDay([task({ id: 'a', day: 1 }), task({ id: 'b', day: 1, done: true })])
    expect(countPendingByDay(byDay).get(1)).toBe(1)
  })

  it('applyTaskMove superpone el movimiento sin mutar la entrada', () => {
    const tasks = [task({ id: 'a', day: 1, startBlock: null })]
    const moved = applyTaskMove(tasks, { id: 'a', day: 3, startBlock: 20 })
    expect(moved[0]?.day).toBe(3)
    expect(moved[0]?.startBlock).toBe(20)
    expect(tasks[0]?.day).toBe(1)
  })

  it('applyTaskMove sin movimiento devuelve una copia intacta', () => {
    const tasks = [task({ id: 'a', day: 2 })]
    expect(applyTaskMove(tasks, null)).toEqual(tasks)
  })
})

describe('sortTasksForDisplay', () => {
  it('las pendientes van antes que las hechas', () => {
    const result = sortTasksForDisplay([task({ id: 'a', done: true }), task({ id: 'b' })])
    expect(result.map((row) => row.id)).toEqual(['b', 'a'])
  })

  it('las fijas abren el día: son su esqueleto', () => {
    const result = sortTasksForDisplay([
      task({ id: 'breve' }),
      task({ id: 'fija', templateId: 'grp:g1:1' }),
    ])
    expect(result.map((row) => row.id)).toEqual(['fija', 'breve'])
  })

  it('ordena por hora y deja al final las que no la tienen', () => {
    const result = sortTasksForDisplay([
      task({ id: 'a', startBlock: null }),
      task({ id: 'b', startBlock: 40 }),
      task({ id: 'c', startBlock: 20 }),
    ])
    expect(result.map((row) => row.id)).toEqual(['c', 'b', 'a'])
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
      { kind: 'day', day: 3 as IsoWeekday } as const,
      { kind: 'slot', day: 3 as IsoWeekday, block: 20 } as const,
    ]
    for (const target of targets) {
      expect(parseDropTargetId(dropTargetId(target))).toEqual(target)
    }
  })

  it('los identificadores son los esperados', () => {
    expect(dropTargetId({ kind: 'day', day: 3 })).toBe('day:3')
    expect(dropTargetId({ kind: 'slot', day: 3, block: 20 })).toBe('slot:3:20')
  })

  it('un id inválido devuelve null en vez de una zona inventada', () => {
    for (const id of [
      'inbox',
      'day:0',
      'day:8',
      'day:x',
      'day:3:1',
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
    expect(parseDropTargetId('day:1')).toEqual({ kind: 'day', day: 1 })
    expect(parseDropTargetId('day:7')).toEqual({ kind: 'day', day: 7 })
    expect(parseDropTargetId('slot:1:0')).toEqual({ kind: 'slot', day: 1, block: 0 })
    expect(parseDropTargetId('slot:7:47')).toEqual({ kind: 'slot', day: 7, block: 47 })
  })
})
