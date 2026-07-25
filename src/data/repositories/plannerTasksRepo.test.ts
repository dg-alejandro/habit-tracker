/*
 * Tests de integración del planificador contra Dexie REAL sobre fake-indexeddb.
 * Aquí vive el riesgo que la lógica pura no puede cubrir sola: que las
 * persistentes vuelvan solas cada semana sin duplicarse, que las puntuales
 * mueran, y que todo ocurra dentro de una única transacción.
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { SYNC_TABLES } from '../types'
import {
  createTask,
  deleteTask,
  duplicateTask,
  ensureWeekReady,
  listWeekTasks,
  moveTask,
  toggleTaskDone,
  updateTask,
} from './plannerTasksRepo'
import { isPersistent } from '../../logic/planner'
import type { WeekId } from '../types'

const PREV: WeekId = '2026-W29'
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

/** Crea una tarea y la coloca de una vez, como hace el arrastre. */
async function place(
  text: string,
  weekId: WeekId,
  persistent: boolean,
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  block: number,
): Promise<string> {
  const created = await createTask({ text, weekId, persistent })
  await moveTask(created.id, day, block)
  return created.id
}

describe('crear tareas', () => {
  it('nace sin colocar: el día y la hora los decide el arrastre', async () => {
    const created = await createTask({ text: 'Llamar', weekId: WEEK, persistent: false })
    expect(created.day).toBeNull()
    expect(created.startBlock).toBeNull()
  })

  it('la persistente nace marcada, y la puntual no', async () => {
    const fija = await createTask({ text: 'Gimnasio', weekId: WEEK, persistent: true })
    const suelta = await createTask({ text: 'Llamar', weekId: WEEK, persistent: false })
    expect(isPersistent(fija)).toBe(true)
    expect(isPersistent(suelta)).toBe(false)
  })

  it('dos persistentes distintas no comparten marca: cada una vuelve a su hueco', async () => {
    const a = await createTask({ text: 'Gimnasio', weekId: WEEK, persistent: true })
    const b = await createTask({ text: 'Leer', weekId: WEEK, persistent: true })
    expect(a.templateId).not.toBe(b.templateId)
  })

  it('admite duración al crearla', async () => {
    const created = await createTask({
      text: 'Gimnasio',
      weekId: WEEK,
      persistent: true,
      estimatedMinutes: 90,
    })
    expect(created.estimatedMinutes).toBe(90)
  })

  it('exige texto y rechaza duraciones que desbordarían la columna del servidor', async () => {
    await expect(createTask({ text: '  ', weekId: WEEK, persistent: false })).rejects.toThrow(
      /texto/,
    )
    await expect(
      createTask({ text: 'X', weekId: WEEK, persistent: false, estimatedMinutes: 1e10 }),
    ).rejects.toThrow(/Duración/)
  })
})

describe('colocar y descolocar', () => {
  it('el arrastre fija día y hora', async () => {
    const created = await createTask({ text: 'Llamar', weekId: WEEK, persistent: false })
    await moveTask(created.id, 3, 20)
    const moved = await db.plannerTasks.get(created.id)
    expect(moved?.day).toBe(3)
    expect(moved?.startBlock).toBe(20)
  })

  it('devolverla a la caja le quita también la hora', async () => {
    const id = await place('Llamar', WEEK, false, 3, 20)
    await moveTask(id, null, 20)
    const moved = await db.plannerTasks.get(id)
    expect(moved?.day).toBeNull()
    expect(moved?.startBlock).toBeNull()
  })

  it('rechaza bloques fuera de la cuadrícula, que el esquema remoto no admite', async () => {
    const created = await createTask({ text: 'Llamar', weekId: WEEK, persistent: false })
    await expect(moveTask(created.id, 1, 48)).rejects.toThrow(/Bloque horario/)
    await expect(moveTask(created.id, 1, -1)).rejects.toThrow(/Bloque horario/)
  })

  it('editar cambia texto, duración y clase en una sola escritura', async () => {
    const created = await createTask({
      text: 'Llamar',
      weekId: WEEK,
      persistent: false,
      estimatedMinutes: 60,
    })
    await updateTask(created.id, {
      text: 'Llamar al fontanero',
      estimatedMinutes: null,
      persistent: true,
      day: 2,
      startBlock: 20,
    })
    const updated = await db.plannerTasks.get(created.id)
    expect(updated?.text).toBe('Llamar al fontanero')
    expect(updated?.day).toBe(2)
    expect(updated === undefined ? true : 'estimatedMinutes' in updated).toBe(false)
    expect(updated === undefined ? false : isPersistent(updated)).toBe(true)
  })

  it('quitarle la persistencia la deja puntual', async () => {
    const created = await createTask({ text: 'Gimnasio', weekId: WEEK, persistent: true })
    await updateTask(created.id, { persistent: false })
    const updated = await db.plannerTasks.get(created.id)
    expect(updated?.templateId).toBeNull()
  })
})

describe('duplicar', () => {
  it('la copia nace sin colocar, para llevarla a otro hueco', async () => {
    const id = await place('Leer', WEEK, true, 1, 40)
    const copy = await duplicateTask(id)
    expect(copy?.text).toBe('Leer')
    expect(copy?.day).toBeNull()
    expect(copy?.done).toBe(false)
  })

  it('la copia de una persistente es persistente por su cuenta', async () => {
    // Si compartieran marca, las dos volverían al mismo hueco la semana siguiente.
    const id = await place('Leer', WEEK, true, 1, 40)
    const original = await db.plannerTasks.get(id)
    const copy = await duplicateTask(id)
    expect(copy === undefined ? false : isPersistent(copy)).toBe(true)
    expect(copy?.templateId).not.toBe(original?.templateId)
  })

  it('la copia de una puntual sigue siendo puntual', async () => {
    const created = await createTask({ text: 'Llamar', weekId: WEEK, persistent: false })
    const copy = await duplicateTask(created.id)
    expect(copy?.templateId).toBeNull()
  })
})

describe('ensureWeekReady — las persistentes vuelven solas', () => {
  it('recrea en la semana nueva las persistentes de la anterior, en su hueco', async () => {
    await place('Gimnasio', WEEK, true, 4, 38)
    await ensureWeekReady(NEXT, NEXT)

    const copies = await listWeekTasks(NEXT)
    expect(copies).toHaveLength(1)
    expect(copies[0]?.text).toBe('Gimnasio')
    expect(copies[0]?.day).toBe(4)
    expect(copies[0]?.startBlock).toBe(38)
    expect(copies[0]?.done).toBe(false)
  })

  it('lo puntual no viaja', async () => {
    await place('Llamar', WEEK, false, 4, 38)
    await ensureWeekReady(NEXT, NEXT)
    expect(await textsOf(NEXT)).toEqual([])
  })

  it('una segunda pasada no duplica: los ids de copia son deterministas', async () => {
    await place('Gimnasio', WEEK, true, 4, 38)
    await ensureWeekReady(NEXT, NEXT)
    await ensureWeekReady(NEXT, NEXT)
    expect(await listWeekTasks(NEXT)).toHaveLength(1)
  })

  it('la cadena aguanta varias semanas seguidas', async () => {
    await place('Gimnasio', PREV, true, 4, 38)
    await ensureWeekReady(WEEK, WEEK)
    await ensureWeekReady(NEXT, NEXT)
    expect(await textsOf(NEXT)).toEqual(['Gimnasio'])
  })

  it('si el planificador lleva semanas cerrado, busca hacia atrás hasta encontrar algo', async () => {
    await place('Gimnasio', '2026-W26', true, 4, 38)
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(WEEK)).toEqual(['Gimnasio'])
  })

  it('no recrea nada si la semana ya tiene contenido', async () => {
    await place('Gimnasio', WEEK, true, 4, 38)
    await createTask({ text: 'Ya escrita', weekId: NEXT, persistent: false })
    await ensureWeekReady(NEXT, NEXT)
    expect(await textsOf(NEXT)).toEqual(['Ya escrita'])
  })

  it('borrar la copia de una semana no la resucita mientras quede algo', async () => {
    await place('Gimnasio', WEEK, true, 4, 38)
    await place('Leer', WEEK, true, 1, 40)
    await ensureWeekReady(NEXT, NEXT)
    const gym = (await listWeekTasks(NEXT)).find((task) => task.text === 'Gimnasio')
    expect(gym).toBeDefined()
    if (gym === undefined) return
    await deleteTask(gym.id)

    await ensureWeekReady(NEXT, NEXT)
    expect(await textsOf(NEXT)).toEqual(['Leer'])
  })

  it('no genera hacia el pasado: una semana anterior vacía se queda vacía', async () => {
    await place('Gimnasio', WEEK, true, 4, 38)
    await ensureWeekReady(PREV, WEEK)
    expect(await textsOf(PREV)).toEqual([])
  })

  it('una persistente sin colocar reaparece igual, esperando hueco', async () => {
    await createTask({ text: 'Leer', weekId: WEEK, persistent: true })
    await ensureWeekReady(NEXT, NEXT)
    const copies = await listWeekTasks(NEXT)
    expect(copies[0]?.text).toBe('Leer')
    expect(copies[0]?.day).toBeNull()
  })
})

describe('ensureWeekReady — las puntuales solo viven su semana', () => {
  it('borra las puntuales sin hacer de semanas anteriores al abrir la actual', async () => {
    const id = await place('Llamar', '2026-W28', false, 3, 20)
    await ensureWeekReady(WEEK, WEEK)
    expect(await db.plannerTasks.get(id)).toBeUndefined()
  })

  it('conserva lo que sí hiciste: es el historial de la semana', async () => {
    const id = await place('Informe', PREV, false, 2, 20)
    await toggleTaskDone(id)
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(PREV)).toEqual(['Informe'])
  })

  it('conserva las persistentes de semanas pasadas, aunque quedaran sin hacer', async () => {
    // Son el registro de que ese jueves no fuiste al gimnasio.
    await place('Gimnasio', PREV, true, 4, 38)
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(PREV)).toEqual(['Gimnasio'])
  })

  it('el borrado se encola para que el otro dispositivo también la pierda', async () => {
    await place('Llamar', PREV, false, 3, 20)
    await db.outbox.clear()
    await ensureWeekReady(WEEK, WEEK)
    const queued = await db.outbox.toArray()
    expect(queued.filter((entry) => entry.op === 'delete')).toHaveLength(1)
  })

  it('la purga no impide recrear las persistentes de la semana nueva', async () => {
    await place('Gimnasio', PREV, true, 4, 38)
    await place('Llamar', PREV, false, 3, 20)
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(WEEK)).toEqual(['Gimnasio'])
    expect(await textsOf(PREV)).toEqual(['Gimnasio'])
  })
})

describe('cola de subida', () => {
  it('cada escritura encola su fila en la misma transacción', async () => {
    await db.outbox.clear()
    const created = await createTask({ text: 'Llamar', weekId: WEEK, persistent: false })
    await toggleTaskDone(created.id)

    const queued = await db.outbox.toArray()
    expect(queued.every((entry) => entry.table === 'plannerTasks')).toBe(true)
    expect(queued.filter((entry) => entry.rowId === created.id)).toHaveLength(2)
  })

  it('la preparación de la semana también encola', async () => {
    await place('Gimnasio', WEEK, true, 4, 38)
    await db.outbox.clear()

    await ensureWeekReady(NEXT, NEXT)
    const queued = await db.outbox.toArray()
    expect(queued.filter((entry) => entry.table === 'plannerTasks')).toHaveLength(1)
  })
})
