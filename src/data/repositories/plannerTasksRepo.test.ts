/*
 * Tests de integración del planificador contra Dexie REAL sobre fake-indexeddb.
 * Aquí vive el riesgo que la lógica pura no puede cubrir sola: la generación de
 * la semana con su marcador derivado, la purga de las tareas breves y que todo
 * ocurra dentro de una única transacción.
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { SYNC_TABLES } from '../types'
import {
  createTask,
  ensureWeekReady,
  listWeekTasks,
  moveTask,
  toggleTaskDone,
  updateTask,
} from './plannerTasksRepo'
import { createFixedTask, deleteFixedTask, listFixedTasks, updateFixedTask } from './taskTemplatesRepo'
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

describe('tareas fijas — una ficha con varios días', () => {
  it('crea una fila por día, agrupadas en una sola ficha', async () => {
    await createFixedTask({
      text: 'Gimnasio',
      days: [
        { weekday: 4, startBlock: 38 },
        { weekday: 6, startBlock: 22 },
      ],
    })
    const fixed = await listFixedTasks()
    expect(fixed).toHaveLength(1)
    expect(fixed[0]?.text).toBe('Gimnasio')
    expect(fixed[0]?.days.map((day) => [day.weekday, day.startBlock])).toEqual([
      [4, 38],
      [6, 22],
    ])
  })

  it('renombrar la ficha renombra todos sus días', async () => {
    const groupId = await createFixedTask({
      text: 'Gimnasio',
      days: [
        { weekday: 4, startBlock: 38 },
        { weekday: 6, startBlock: 22 },
      ],
    })
    await updateFixedTask(groupId, {
      text: 'Gym',
      days: [
        { weekday: 4, startBlock: 38 },
        { weekday: 6, startBlock: 22 },
      ],
    })
    const fixed = await listFixedTasks()
    expect(fixed).toHaveLength(1)
    expect(fixed[0]?.text).toBe('Gym')
  })

  it('quitar un día borra su fila y añadir otro la crea', async () => {
    const groupId = await createFixedTask({
      text: 'Gimnasio',
      days: [
        { weekday: 4, startBlock: 38 },
        { weekday: 6, startBlock: 22 },
      ],
    })
    await updateFixedTask(groupId, {
      text: 'Gimnasio',
      days: [
        { weekday: 4, startBlock: 40 },
        { weekday: 2, startBlock: null },
      ],
    })
    const fixed = await listFixedTasks()
    expect(fixed[0]?.days.map((day) => [day.weekday, day.startBlock])).toEqual([
      [2, null],
      [4, 40],
    ])
  })

  it('borrar la ficha borra todos sus días', async () => {
    const groupId = await createFixedTask({
      text: 'Gimnasio',
      days: [{ weekday: 4, startBlock: 38 }, { weekday: 6, startBlock: null }],
    })
    await deleteFixedTask(groupId)
    expect(await listFixedTasks()).toEqual([])
    expect(await db.taskTemplates.count()).toBe(0)
  })

  it('exige nombre y al menos un día', async () => {
    await expect(createFixedTask({ text: '  ', days: [{ weekday: 1, startBlock: null }] })).rejects.toThrow(
      /nombre/,
    )
    await expect(createFixedTask({ text: 'Algo', days: [] })).rejects.toThrow(/al menos un día/)
  })

  it('rechaza bloques y duraciones que el servidor no admitiría', async () => {
    await expect(
      createFixedTask({ text: 'Algo', days: [{ weekday: 1, startBlock: 48 }] }),
    ).rejects.toThrow(/Bloque horario/)
    await expect(
      createFixedTask({
        text: 'Algo',
        days: [{ weekday: 1, startBlock: null, estimatedMinutes: 1e10 }],
      }),
    ).rejects.toThrow(/Duración/)
  })
})

describe('ensureWeekReady — generación de la semana', () => {
  it('genera un día por cada día de cada tarea fija', async () => {
    await createFixedTask({
      text: 'Gimnasio',
      days: [
        { weekday: 4, startBlock: 38 },
        { weekday: 6, startBlock: 22 },
      ],
    })
    await ensureWeekReady(WEEK, WEEK)
    const tasks = await listWeekTasks(WEEK)
    expect(tasks).toHaveLength(2)
    expect(tasks.map((task) => task.day).sort()).toEqual([4, 6])
  })

  it('una segunda pasada no duplica: los ids generados son deterministas', async () => {
    await createFixedTask({ text: 'Gimnasio', days: [{ weekday: 4, startBlock: 38 }] })
    await ensureWeekReady(WEEK, WEEK)
    await ensureWeekReady(WEEK, WEEK)
    expect(await listWeekTasks(WEEK)).toHaveLength(1)
  })

  it('no resucita una tarea fija borrada mientras quede algo en la semana', async () => {
    await createFixedTask({ text: 'Gimnasio', days: [{ weekday: 4, startBlock: 38 }] })
    await createFixedTask({ text: 'Compra', days: [{ weekday: 6, startBlock: null }] })
    await ensureWeekReady(WEEK, WEEK)
    const compra = (await listWeekTasks(WEEK)).find((task) => task.text === 'Compra')
    expect(compra).toBeDefined()
    if (compra === undefined) return
    await db.plannerTasks.delete(compra.id)

    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(WEEK)).toEqual(['Gimnasio'])
  })

  it('no genera hacia el pasado: una semana anterior vacía se queda vacía', async () => {
    await createFixedTask({ text: 'Gimnasio', days: [{ weekday: 4, startBlock: 38 }] })
    await ensureWeekReady('2026-W29', WEEK)
    expect(await textsOf('2026-W29')).toEqual([])
  })

  it('genera en una semana futura al visitarla', async () => {
    await createFixedTask({ text: 'Gimnasio', days: [{ weekday: 4, startBlock: 38 }] })
    await ensureWeekReady(NEXT, WEEK)
    expect(await textsOf(NEXT)).toEqual(['Gimnasio'])
  })
})

describe('ensureWeekReady — las tareas breves solo viven su semana', () => {
  it('borra las breves sin hacer de semanas anteriores al abrir la actual', async () => {
    const vieja = await createTask({ text: 'Llamar', weekId: '2026-W28', day: 3 })
    await ensureWeekReady(WEEK, WEEK)
    expect(await db.plannerTasks.get(vieja.id)).toBeUndefined()
  })

  it('conserva lo que sí hiciste: es el historial de la semana', async () => {
    const hecha = await createTask({ text: 'Informe', weekId: '2026-W29', day: 2 })
    await toggleTaskDone(hecha.id)
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf('2026-W29')).toEqual(['Informe'])
  })

  it('conserva las generadas por una tarea fija, aunque quedaran sin hacer', async () => {
    await createFixedTask({ text: 'Gimnasio', days: [{ weekday: 4, startBlock: 38 }] })
    await ensureWeekReady('2026-W29', '2026-W29')
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf('2026-W29')).toEqual(['Gimnasio'])
  })

  it('no toca la semana visitada si no es la actual', async () => {
    await createTask({ text: 'Llamar', weekId: '2026-W29', day: 3 })
    await ensureWeekReady(NEXT, WEEK)
    expect(await textsOf('2026-W29')).toEqual(['Llamar'])
  })

  it('el borrado se encola para que el otro dispositivo también la pierda', async () => {
    await createTask({ text: 'Llamar', weekId: '2026-W29', day: 3 })
    await db.outbox.clear()
    await ensureWeekReady(WEEK, WEEK)
    const queued = await db.outbox.toArray()
    expect(queued.filter((entry) => entry.op === 'delete')).toHaveLength(1)
  })

  it('la purga no impide generar las fijas de la semana nueva', async () => {
    await createFixedTask({ text: 'Gimnasio', days: [{ weekday: 4, startBlock: 38 }] })
    await createTask({ text: 'Llamar', weekId: '2026-W29', day: 3 })
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(WEEK)).toEqual(['Gimnasio'])
    expect(await textsOf('2026-W29')).toEqual([])
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
      createTask({ text: 'Tarea', weekId: WEEK, day: 1, estimatedMinutes: 999999999999 }),
    ).rejects.toThrow(/Duración/)
    const created = await createTask({ text: 'Otra', weekId: WEEK, day: 1 })
    await expect(updateTask(created.id, { estimatedMinutes: 1e10 })).rejects.toThrow(/Duración/)
  })

  it('una tarea puede quedarse en su día sin hora', async () => {
    const created = await createTask({ text: 'Tarea', weekId: WEEK, day: 1, startBlock: 20 })
    await moveTask(created.id, 3, null)
    const moved = await db.plannerTasks.get(created.id)
    expect(moved?.day).toBe(3)
    expect(moved?.startBlock).toBeNull()
  })

  it('editar quita la duración cuando se pide, en una sola escritura', async () => {
    const created = await createTask({ text: 'Tarea', weekId: WEEK, day: 1, estimatedMinutes: 60 })
    await updateTask(created.id, {
      text: 'Tarea larga',
      estimatedMinutes: null,
      day: 2,
      startBlock: 20,
    })
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
    const created = await createTask({ text: 'Tarea', weekId: WEEK, day: 1 })
    await toggleTaskDone(created.id)

    const queued = await db.outbox.toArray()
    expect(queued.every((entry) => entry.table === 'plannerTasks')).toBe(true)
    expect(queued.filter((entry) => entry.rowId === created.id)).toHaveLength(2)
  })

  it('la generación de la semana también encola', async () => {
    await createFixedTask({ text: 'Gimnasio', days: [{ weekday: 4, startBlock: 38 }] })
    await db.outbox.clear()

    await ensureWeekReady(WEEK, WEEK)
    const queued = await db.outbox.toArray()
    expect(queued.filter((entry) => entry.table === 'plannerTasks')).toHaveLength(1)
  })
})
