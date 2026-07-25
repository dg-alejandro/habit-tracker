/*
 * Tests de integración del planificador contra Dexie REAL sobre fake-indexeddb.
 * Aquí vive el riesgo que la lógica pura no puede cubrir sola: el orden
 * generar → arrastrar, el marcador derivado de materialización y que todo
 * ocurra dentro de una única transacción.
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { SYNC_TABLES } from '../types'
import {
  createTask,
  duplicatePreviousWeek,
  ensureWeekReady,
  listWeekTasks,
  moveTask,
  toggleTaskDone,
  updateTask,
} from './plannerTasksRepo'
import { createTaskTemplate } from './taskTemplatesRepo'
import type { WeekId } from '../types'

const WEEK: WeekId = '2026-W30'
const NEXT: WeekId = '2026-W31'

afterEach(async () => {
  await db.transaction(
    'rw',
    [...SYNC_TABLES.map((table) => db.table(table)), db.outbox],
    async () => {
      for (const table of SYNC_TABLES) await db.table(table).clear()
      await db.outbox.clear()
    },
  )
})

/** Textos de una semana, ordenados, para comparar sin depender de ids. */
async function textsOf(weekId: WeekId): Promise<string[]> {
  const tasks = await listWeekTasks(weekId)
  return tasks.map((task) => task.text).sort()
}

describe('ensureWeekReady — materialización de la semana', () => {
  it('genera las tareas fijas al abrir una semana vacía', async () => {
    await createTaskTemplate({ text: 'Gimnasio', weekday: 4, startBlock: 38 })
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(WEEK)).toEqual(['Gimnasio'])
  })

  it('una segunda pasada no duplica: los ids generados son deterministas', async () => {
    await createTaskTemplate({ text: 'Gimnasio', weekday: 4, startBlock: 38 })
    await ensureWeekReady(WEEK, WEEK)
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(WEEK)).toEqual(['Gimnasio'])
  })

  it('no resucita una tarea fija borrada mientras quede algo en la semana', async () => {
    await createTaskTemplate({ text: 'Gimnasio', weekday: 4, startBlock: 38 })
    await createTaskTemplate({ text: 'Compra', weekday: 6, startBlock: null })
    await ensureWeekReady(WEEK, WEEK)
    const generated = await listWeekTasks(WEEK)
    const compra = generated.find((task) => task.text === 'Compra')
    expect(compra).toBeDefined()
    if (compra === undefined) return
    await db.plannerTasks.delete(compra.id)

    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(WEEK)).toEqual(['Gimnasio'])
  })

  it('no genera hacia el pasado: una semana anterior vacía se queda vacía', async () => {
    await createTaskTemplate({ text: 'Gimnasio', weekday: 4, startBlock: 38 })
    await ensureWeekReady('2026-W29', WEEK)
    expect(await textsOf('2026-W29')).toEqual([])
  })

  it('genera en una semana futura al visitarla', async () => {
    await createTaskTemplate({ text: 'Gimnasio', weekday: 4, startBlock: 38 })
    await ensureWeekReady(NEXT, WEEK)
    expect(await textsOf(NEXT)).toEqual(['Gimnasio'])
  })
})

describe('ensureWeekReady — arrastre semanal', () => {
  it('vuelca al inbox lo pendiente de semanas anteriores con su contador', async () => {
    const vieja = await createTask({ text: 'Llamar', weekId: '2026-W28', day: 3, startBlock: 20 })
    await ensureWeekReady(WEEK, WEEK)

    const moved = await db.plannerTasks.get(vieja.id)
    expect(moved?.weekId).toBe(WEEK)
    expect(moved?.day).toBeNull()
    expect(moved?.startBlock).toBeNull()
    // De la W28 a la W30 hay dos semanas, no una.
    expect(moved?.carriedOverCount).toBe(2)
  })

  it('deja donde están las completadas y las de plantilla', async () => {
    await createTaskTemplate({ text: 'Gimnasio', weekday: 4, startBlock: 38 })
    await ensureWeekReady('2026-W29', '2026-W29')
    const hecha = await createTask({ text: 'Hecha', weekId: '2026-W29' })
    await toggleTaskDone(hecha.id)

    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf('2026-W29')).toEqual(['Gimnasio', 'Hecha'])
  })

  it('el arrastre no vuelve a disparar la generación de la semana', async () => {
    // Si se arrastrara ANTES de generar, la semana dejaría de estar vacía y las
    // tareas fijas no se crearían nunca más.
    await createTaskTemplate({ text: 'Gimnasio', weekday: 4, startBlock: 38 })
    await createTask({ text: 'Llamar', weekId: '2026-W29' })

    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(WEEK)).toEqual(['Gimnasio', 'Llamar'])
  })

  it('es idempotente: repetirlo no mueve nada más ni sube el contador', async () => {
    const vieja = await createTask({ text: 'Llamar', weekId: '2026-W29' })
    await ensureWeekReady(WEEK, WEEK)
    await ensureWeekReady(WEEK, WEEK)

    const moved = await db.plannerTasks.get(vieja.id)
    expect(moved?.carriedOverCount).toBe(1)
    expect(await textsOf(WEEK)).toEqual(['Llamar'])
  })

  it('mirar una semana futura no arrastra nada a esa semana', async () => {
    await createTask({ text: 'Llamar', weekId: '2026-W29' })
    await ensureWeekReady(NEXT, WEEK)
    expect(await textsOf(NEXT)).toEqual([])
    expect(await textsOf('2026-W29')).toEqual(['Llamar'])
  })
})

describe('duplicatePreviousWeek', () => {
  it('copia las completadas sin su estado y no toca las pendientes', async () => {
    const hecha = await createTask({ text: 'Informe', weekId: WEEK, day: 2, startBlock: 20 })
    await toggleTaskDone(hecha.id)
    await createTask({ text: 'Llamada', weekId: WEEK, day: 3 })

    const copied = await duplicatePreviousWeek(NEXT)
    expect(copied).toBe(1)
    const copies = await listWeekTasks(NEXT)
    expect(copies.map((task) => task.text)).toEqual(['Informe'])
    expect(copies[0]?.done).toBe(false)
    expect(copies[0]?.startBlock).toBe(20)
  })

  it('duplicar y luego arrastrar no deja la misma tarea dos veces', async () => {
    // El caso del domingo: preparo la semana que viene y el lunes se arrastra.
    const hecha = await createTask({ text: 'Informe', weekId: WEEK, day: 2 })
    await toggleTaskDone(hecha.id)
    await createTask({ text: 'Llamada', weekId: WEEK, day: 3 })

    await duplicatePreviousWeek(NEXT)
    await ensureWeekReady(NEXT, NEXT)

    expect(await textsOf(NEXT)).toEqual(['Informe', 'Llamada'])
  })

  it('no copia las generadas por plantilla: la semana destino genera las suyas', async () => {
    await createTaskTemplate({ text: 'Gimnasio', weekday: 4, startBlock: 38 })
    await ensureWeekReady(WEEK, WEEK)
    const generated = await listWeekTasks(WEEK)
    await toggleTaskDone(generated[0]?.id ?? '')

    expect(await duplicatePreviousWeek(NEXT)).toBe(0)
  })
})

describe('validación de escrituras', () => {
  it('rechaza bloques fuera de la cuadrícula, que el esquema remoto no admite', async () => {
    const created = await createTask({ text: 'Tarea', weekId: WEEK, day: 1 })
    await expect(moveTask(created.id, 1, 48)).rejects.toThrow(/Bloque horario/)
    await expect(moveTask(created.id, 1, -1)).rejects.toThrow(/Bloque horario/)
    await expect(createTask({ text: 'X', weekId: WEEK, day: 1, startBlock: 48 })).rejects.toThrow()
  })

  it('rechaza duraciones que desbordarían la columna entera del servidor', async () => {
    await expect(
      createTask({ text: 'Tarea', weekId: WEEK, estimatedMinutes: 999999999999 }),
    ).rejects.toThrow(/Duración/)
    const created = await createTask({ text: 'Otra', weekId: WEEK })
    await expect(updateTask(created.id, { estimatedMinutes: 1e10 })).rejects.toThrow(/Duración/)
  })

  it('sin día no puede quedar una hora colgada', async () => {
    const created = await createTask({ text: 'Tarea', weekId: WEEK, day: 1, startBlock: 20 })
    await moveTask(created.id, null, 20)
    const moved = await db.plannerTasks.get(created.id)
    expect(moved?.day).toBeNull()
    expect(moved?.startBlock).toBeNull()
  })

  it('editar quita la duración cuando se pide, en una sola escritura', async () => {
    const created = await createTask({ text: 'Tarea', weekId: WEEK, estimatedMinutes: 60 })
    await updateTask(created.id, { text: 'Tarea larga', estimatedMinutes: null, day: 2, startBlock: 20 })
    const updated = await db.plannerTasks.get(created.id)
    expect(updated?.text).toBe('Tarea larga')
    expect(updated?.day).toBe(2)
    expect(updated?.startBlock).toBe(20)
    expect(updated === undefined ? true : 'estimatedMinutes' in updated).toBe(false)
  })
})

describe('cola de subida', () => {
  it('cada escritura encola su fila en la misma transacción', async () => {
    await db.outbox.clear()
    const created = await createTask({ text: 'Tarea', weekId: WEEK })
    await toggleTaskDone(created.id)

    const queued = await db.outbox.toArray()
    expect(queued.every((entry) => entry.table === 'plannerTasks')).toBe(true)
    expect(queued.filter((entry) => entry.rowId === created.id).length).toBe(2)
  })

  it('la materialización y el arrastre también encolan', async () => {
    await createTaskTemplate({ text: 'Gimnasio', weekday: 4, startBlock: 38 })
    await createTask({ text: 'Llamar', weekId: '2026-W29' })
    await db.outbox.clear()

    await ensureWeekReady(WEEK, WEEK)
    const queued = await db.outbox.toArray()
    expect(queued.filter((entry) => entry.table === 'plannerTasks')).toHaveLength(2)
  })
})
