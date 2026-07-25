/*
 * Tests del planificador (CLAUDE.md §4). Semana de referencia: '2026-W30',
 * del lunes 20 al domingo 26 de julio de 2026.
 * La suite corre bajo TZ=America/New_York (vite.config.ts): zona hostil.
 */
import { describe, expect, it } from 'vitest'
import {
  BLOCKS_PER_DAY,
  blockLabel,
  blockRangeLabel,
  blockSpan,
  blockToMinutes,
  carryLabel,
  carryLevel,
  applyTaskMove,
  countNightTasks,
  countPendingByDay,
  dropTargetId,
  durationLabel,
  generateWeekTasks,
  generatedTaskId,
  groupTasksByDay,
  isValidBlock,
  isValidEstimatedMinutes,
  layoutDayTasks,
  parseDropTargetId,
  planCarryOver,
  planDuplicateWeek,
  scheduledTasksByDay,
  sortTasksForDisplay,
  visibleSpan,
} from './planner'
import type { CarryOverPatch } from './planner'
import type { IsoWeekday, PlannerTask, TaskTemplate, WeekId } from '../data/types'

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

/** Aplica un parche de arrastre, para poder comprobar la idempotencia de verdad. */
function applyPatch(source: PlannerTask, patch: CarryOverPatch): PlannerTask {
  return { ...source, ...patch }
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

describe('generatedTaskId — la clave de la convergencia', () => {
  it('es determinista entre llamadas', () => {
    expect(generatedTaskId('t1', WEEK)).toBe(generatedTaskId('t1', WEEK))
  })

  it('cambia con la plantilla y con la semana', () => {
    expect(generatedTaskId('t1', WEEK)).not.toBe(generatedTaskId('t2', WEEK))
    expect(generatedTaskId('t1', WEEK)).not.toBe(generatedTaskId('t1', '2026-W31'))
  })

  it('lleva prefijo, así que no puede colisionar con el uuid de una tarea ocasional', () => {
    expect(generatedTaskId('t1', WEEK).startsWith('tpl:')).toBe(true)
  })
})

describe('generateWeekTasks — materialización de la semana', () => {
  it('una plantilla genera su tarea en su día, su bloque y su duración', () => {
    const result = generateWeekTasks({
      templates: [template({ id: 't1', text: 'Gimnasio', weekday: 4, startBlock: 38, estimatedMinutes: 60 })],
      weekId: WEEK,
    })
    expect(result).toEqual([
      {
        id: 'tpl:t1:2026-W30',
        text: 'Gimnasio',
        weekId: WEEK,
        day: 4,
        startBlock: 38,
        estimatedMinutes: 60,
        done: false,
        templateId: 't1',
        carriedOverCount: 0,
      },
    ])
  })

  it('nace pendiente, sin arrastre y apuntando a su plantilla', () => {
    const [generated] = generateWeekTasks({ templates: [template({ id: 't1' })], weekId: WEEK })
    expect(generated?.done).toBe(false)
    expect(generated?.carriedOverCount).toBe(0)
    expect(generated?.templateId).toBe('t1')
  })

  it('sin plantillas no genera nada', () => {
    expect(generateWeekTasks({ templates: [], weekId: WEEK })).toEqual([])
  })

  it('una plantilla sin hora aterriza en la lista de su día, no en el inbox', () => {
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

  it('dos plantillas en el mismo día y bloque generan dos tareas distintas', () => {
    const result = generateWeekTasks({
      templates: [
        template({ id: 't1', weekday: 2, startBlock: 20 }),
        template({ id: 't2', weekday: 2, startBlock: 20 }),
      ],
      weekId: WEEK,
    })
    expect(result).toHaveLength(2)
    expect(new Set(result.map((row) => row.id)).size).toBe(2)
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

describe('planCarryOver — arrastre al inbox de la semana nueva', () => {
  const TARGET: WeekId = '2026-W31'

  it('una pendiente ocasional se muda al inbox destino perdiendo día y hora', () => {
    const stale = task({ id: 'a', weekId: WEEK, day: 3, startBlock: 20 })
    expect(planCarryOver({ staleTasks: [stale], targetWeek: TARGET })).toEqual([
      { id: 'a', weekId: TARGET, day: null, startBlock: null, carriedOverCount: 1 },
    ])
  })

  it('tras una semana el contador sube a 1', () => {
    const stale = task({ id: 'a', weekId: WEEK, carriedOverCount: 0 })
    expect(planCarryOver({ staleTasks: [stale], targetWeek: TARGET })[0]?.carriedOverCount).toBe(1)
  })

  it('tres semanas sin abrir la app suman 3, no 1: la tarea debe llegar en rojo', () => {
    const stale = task({ id: 'a', weekId: '2026-W28' })
    expect(planCarryOver({ staleTasks: [stale], targetWeek: TARGET })[0]?.carriedOverCount).toBe(3)
  })

  it('el contador acumula sobre el que ya traía', () => {
    const stale = task({ id: 'a', weekId: WEEK, carriedOverCount: 2 })
    expect(planCarryOver({ staleTasks: [stale], targetWeek: TARGET })[0]?.carriedOverCount).toBe(3)
  })

  it('no toca las completadas: lo hecho se queda en su semana', () => {
    const stale = task({ id: 'a', weekId: WEEK, done: true })
    expect(planCarryOver({ staleTasks: [stale], targetWeek: TARGET })).toEqual([])
  })

  it('no arrastra las de plantilla ni cuando están pendientes (§4)', () => {
    const stale = task({ id: 'a', weekId: WEEK, templateId: 't1' })
    expect(planCarryOver({ staleTasks: [stale], targetWeek: TARGET })).toEqual([])
  })

  it('ignora las de la propia semana destino y las futuras', () => {
    const own = task({ id: 'a', weekId: TARGET })
    const future = task({ id: 'b', weekId: '2026-W40' })
    expect(planCarryOver({ staleTasks: [own, future], targetWeek: TARGET })).toEqual([])
  })

  it('es idempotente: aplicado el parche, la segunda pasada no devuelve nada', () => {
    const stale = task({ id: 'a', weekId: WEEK })
    const [patch] = planCarryOver({ staleTasks: [stale], targetWeek: TARGET })
    expect(patch).toBeDefined()
    if (patch === undefined) return
    const moved = applyPatch(stale, patch)
    expect(planCarryOver({ staleTasks: [moved], targetWeek: TARGET })).toEqual([])
  })

  it('tareas de tres semanas distintas aterrizan juntas, cada una con su delta', () => {
    const patches = planCarryOver({
      staleTasks: [
        task({ id: 'a', weekId: '2026-W28' }),
        task({ id: 'b', weekId: '2026-W29' }),
        task({ id: 'c', weekId: '2026-W30' }),
      ],
      targetWeek: TARGET,
    })
    expect(patches.map((patch) => patch.weekId)).toEqual([TARGET, TARGET, TARGET])
    expect(patches.map((patch) => patch.carriedOverCount)).toEqual([3, 2, 1])
  })

  it('cruza el año ISO contando semanas de verdad', () => {
    const stale = task({ id: 'a', weekId: '2020-W52' })
    expect(planCarryOver({ staleTasks: [stale], targetWeek: '2021-W01' })[0]?.carriedOverCount).toBe(2)
  })

  it('sin tareas viejas no hay nada que arrastrar', () => {
    expect(planCarryOver({ staleTasks: [], targetWeek: TARGET })).toEqual([])
  })

  it('un weekId corrupto no lanza: arrastra contando una semana', () => {
    // Si lanzara, abortaría la transacción de preparación entera y el
    // planificador dejaría de generar y arrastrar en silencio y para siempre.
    const stale = task({ id: 'a', weekId: '2026-W00' })
    expect(planCarryOver({ staleTasks: [stale], targetWeek: TARGET })).toEqual([
      { id: 'a', weekId: TARGET, day: null, startBlock: null, carriedOverCount: 1 },
    ])
  })

  it('un contador corrupto (negativo) parte de cero en vez de propagarse', () => {
    const stale = task({ id: 'a', weekId: WEEK, carriedOverCount: -5 })
    expect(planCarryOver({ staleTasks: [stale], targetWeek: TARGET })[0]?.carriedOverCount).toBe(1)
  })
})

describe('planDuplicateWeek — duplicar la semana anterior', () => {
  const TARGET: WeekId = '2026-W31'

  it('copia texto, día, bloque y duración', () => {
    const source = task({
      id: 'a',
      text: 'Informe',
      day: 2,
      startBlock: 20,
      estimatedMinutes: 90,
      done: true,
    })
    expect(planDuplicateWeek({ sourceTasks: [source], targetWeek: TARGET })).toEqual([
      {
        text: 'Informe',
        weekId: TARGET,
        day: 2,
        startBlock: 20,
        estimatedMinutes: 90,
        done: false,
        templateId: null,
        carriedOverCount: 0,
      },
    ])
  })

  it('la copia llega sin el estado de completado (§4) y sin arrastre', () => {
    const source = task({ id: 'a', done: true, carriedOverCount: 4 })
    const [draft] = planDuplicateWeek({ sourceTasks: [source], targetWeek: TARGET })
    expect(draft?.done).toBe(false)
    expect(draft?.carriedOverCount).toBe(0)
  })

  it('excluye las generadas por plantilla: la semana destino genera las suyas', () => {
    const source = task({ id: 'a', templateId: 't1', done: true })
    expect(planDuplicateWeek({ sourceTasks: [source], targetWeek: TARGET })).toEqual([])
  })

  it('NO copia las pendientes: esas ya viajan solas con el arrastre', () => {
    // Copiarlas dejaría cada tarea dos veces en la semana destino: la copia con
    // su día y su hora, y el original al arrastrarse al inbox.
    expect(planDuplicateWeek({ sourceTasks: [task({ id: 'a' })], targetWeek: TARGET })).toEqual([])
  })

  it('duplicar y arrastrar sobre la misma semana destino no deja duplicados', () => {
    const hecha = task({ id: 'a', text: 'Informe', day: 2, done: true })
    const pendiente = task({ id: 'b', text: 'Llamada', day: 3 })
    const copias = planDuplicateWeek({ sourceTasks: [hecha, pendiente], targetWeek: TARGET })
    const arrastres = planCarryOver({ staleTasks: [hecha, pendiente], targetWeek: TARGET })
    expect(copias.map((copia) => copia.text)).toEqual(['Informe'])
    expect(arrastres.map((patch) => patch.id)).toEqual(['b'])
  })

  it('la copia nace ocasional, así que sí se arrastrará si no se hace', () => {
    const [draft] = planDuplicateWeek({
      sourceTasks: [task({ id: 'a', done: true })],
      targetWeek: TARGET,
    })
    expect(draft?.templateId).toBeNull()
  })

  it('copia también las del inbox conservando su falta de día', () => {
    const [draft] = planDuplicateWeek({
      sourceTasks: [task({ id: 'a', day: null, startBlock: null, done: true })],
      targetWeek: TARGET,
    })
    expect(draft?.day).toBeNull()
    expect(draft?.startBlock).toBeNull()
  })

  it('una semana origen vacía no copia nada', () => {
    expect(planDuplicateWeek({ sourceTasks: [], targetWeek: TARGET })).toEqual([])
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
    const result = layoutDayTasks([scheduled('a', 20, 60), scheduled('b', 20, 60), scheduled('c', 20, 60)])
    expect(result.map((placement) => placement.lanes)).toEqual([3, 3, 3])
    expect(new Set(result.map((placement) => placement.lane)).size).toBe(3)
  })

  it('en una cadena A–B–C, A y C reutilizan carril y las tres comparten ancho', () => {
    // A(20–22) solapa con B(21–23), que solapa con C(22–24): un solo grupo conexo.
    const result = layoutDayTasks([scheduled('a', 20, 60), scheduled('b', 21, 60), scheduled('c', 22, 60)])
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
    const result = layoutDayTasks([scheduled('a', 20, 30), { ...scheduled('b', 30, 30), done: true }])
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
  it('groupTasksByDay deja fuera las del inbox', () => {
    const byDay = groupTasksByDay([task({ id: 'a', day: 3 }), task({ id: 'b', day: null })])
    expect([...byDay.keys()]).toEqual([3])
    expect(byDay.get(3)?.map((row) => row.id)).toEqual(['a'])
  })

  it('scheduledTasksByDay separa las que tienen hora de las que no', () => {
    const byDay = groupTasksByDay([scheduled('a', 20), task({ id: 'b', day: 1 })])
    expect(scheduledTasksByDay(byDay).get(1)?.map((row) => row.id)).toEqual(['a'])
  })

  it('countPendingByDay no cuenta las completadas', () => {
    const byDay = groupTasksByDay([
      task({ id: 'a', day: 1 }),
      task({ id: 'b', day: 1, done: true }),
    ])
    expect(countPendingByDay(byDay).get(1)).toBe(1)
  })

  it('applyTaskMove superpone el movimiento sin mutar la entrada', () => {
    const tasks = [task({ id: 'a', day: null, startBlock: null })]
    const moved = applyTaskMove(tasks, { id: 'a', day: 3, startBlock: 20 })
    expect(moved[0]?.day).toBe(3)
    expect(moved[0]?.startBlock).toBe(20)
    expect(tasks[0]?.day).toBeNull()
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

  it('entre pendientes, la más arrastrada grita primero', () => {
    const result = sortTasksForDisplay([
      task({ id: 'a', carriedOverCount: 0 }),
      task({ id: 'b', carriedOverCount: 3 }),
      task({ id: 'c', carriedOverCount: 1 }),
    ])
    expect(result.map((row) => row.id)).toEqual(['b', 'c', 'a'])
  })

  it('a igualdad de arrastre, ordena por hora y deja al final las que no la tienen', () => {
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

describe('carryLevel y carryLabel — la alarma de §4', () => {
  it('el rojo entra a la TERCERA semana arrastrada', () => {
    expect(carryLevel(0)).toBe('none')
    expect(carryLevel(1)).toBe('warn')
    expect(carryLevel(2)).toBe('warn')
    expect(carryLevel(3)).toBe('alarm')
    expect(carryLevel(10)).toBe('alarm')
  })

  it('un contador corrupto no enciende la alarma', () => {
    expect(carryLevel(-1)).toBe('none')
  })

  it('la etiqueta cuenta arrastres, así que marca 3 justo cuando entra el rojo', () => {
    expect(carryLabel(0)).toBeNull()
    expect(carryLabel(1)).toBe('Arrastrada 1 semana')
    expect(carryLabel(3)).toBe('Arrastrada 3 semanas')
    expect(carryLevel(3)).toBe('alarm')
  })
})

describe('zonas de soltado', () => {
  it('ida y vuelta de los tres tipos de zona', () => {
    const targets = [
      { kind: 'inbox' } as const,
      { kind: 'day', day: 3 as IsoWeekday } as const,
      { kind: 'slot', day: 3 as IsoWeekday, block: 20 } as const,
    ]
    for (const target of targets) {
      expect(parseDropTargetId(dropTargetId(target))).toEqual(target)
    }
  })

  it('los identificadores son los esperados', () => {
    expect(dropTargetId({ kind: 'inbox' })).toBe('inbox')
    expect(dropTargetId({ kind: 'day', day: 3 })).toBe('day:3')
    expect(dropTargetId({ kind: 'slot', day: 3, block: 20 })).toBe('slot:3:20')
  })

  it('un id inválido devuelve null en vez de una zona inventada', () => {
    for (const id of ['day:0', 'day:8', 'day:x', 'day:3:1', 'slot:3:48', 'slot:x:1', 'slot:3', '', 'otro']) {
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
