/*
 * Tests de integración del planificador contra Dexie REAL sobre fake-indexeddb.
 * Aquí vive el riesgo que la lógica pura no puede cubrir sola: que el banco se
 * quede intacto al tirar de él, que las puntuales mueran al cambiar de semana,
 * y que todo ocurra dentro de una única transacción.
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { SYNC_TABLES } from '../types'
import {
  createTask,
  createTaskFromBank,
  deleteTask,
  ensureWeekReady,
  listWeekTasks,
  moveTask,
  toggleTaskDone,
  updateTask,
} from './plannerTasksRepo'
import {
  createBankTask,
  deleteBankTask,
  listBankTasks,
  updateBankTask,
} from './taskBankRepo'
import { isFromBank } from '../../logic/planner'
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

/** Crea una tarea puntual y la coloca de una vez, como hace el arrastre. */
async function place(
  text: string,
  weekId: WeekId,
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  block: number,
): Promise<string> {
  const created = await createTask({ text, weekId })
  await moveTask(created.id, day, block)
  return created.id
}

describe('el banco de tareas', () => {
  it('guarda nombre y duracion, y sale ordenado', async () => {
    await createBankTask({ text: 'Leer', estimatedMinutes: 30 })
    await createBankTask({ text: 'Gimnasio', estimatedMinutes: 60 })
    const bank = await listBankTasks()
    expect(bank.map((item) => item.text)).toEqual(['Gimnasio', 'Leer'])
    expect(bank[0]?.estimatedMinutes).toBe(60)
  })

  it('exige nombre y rechaza duraciones que desbordarian la columna del servidor', async () => {
    await expect(createBankTask({ text: '  ' })).rejects.toThrow(/nombre/)
    await expect(createBankTask({ text: 'X', estimatedMinutes: 1e10 })).rejects.toThrow(/Duracion|Duración/)
  })

  it('editar una ficha puede quitarle la duracion', async () => {
    const created = await createBankTask({ text: 'Leer', estimatedMinutes: 30 })
    await updateBankTask(created.id, { text: 'Leer un rato' })
    const bank = await listBankTasks()
    expect(bank[0]?.text).toBe('Leer un rato')
    expect(bank[0]?.estimatedMinutes).toBeUndefined()
  })

  it('sacarla del banco no toca las tareas que ya se colocaron con ella', async () => {
    const item = await createBankTask({ text: 'Gimnasio' })
    await createTaskFromBank(item, WEEK, 4, 38)
    await deleteBankTask(item.id)
    expect(await listBankTasks()).toEqual([])
    expect(await textsOf(WEEK)).toEqual(['Gimnasio'])
  })
})

describe('sacar tareas del banco', () => {
  it('coloca una tarea nueva con el texto y la duracion de la ficha', async () => {
    const item = await createBankTask({ text: 'Gimnasio', estimatedMinutes: 60 })
    const placed = await createTaskFromBank(item, WEEK, 4, 38)
    expect(placed.text).toBe('Gimnasio')
    expect(placed.day).toBe(4)
    expect(placed.startBlock).toBe(38)
    expect(placed.estimatedMinutes).toBe(60)
    expect(isFromBank(placed)).toBe(true)
  })

  it('la ficha se queda: la misma se suelta tantas veces como haga falta', async () => {
    // «Leer» de lunes a viernes son cinco arrastres de la misma ficha.
    const item = await createBankTask({ text: 'Leer' })
    for (const day of [1, 2, 3, 4, 5] as const) {
      await createTaskFromBank(item, WEEK, day, 40)
    }
    expect(await listBankTasks()).toHaveLength(1)
    expect(await listWeekTasks(WEEK)).toHaveLength(5)
  })

  it('rechaza bloques fuera de la cuadricula, que el esquema remoto no admite', async () => {
    const item = await createBankTask({ text: 'Gimnasio' })
    await expect(createTaskFromBank(item, WEEK, 1, 48)).rejects.toThrow(/Bloque horario/)
  })
})

describe('crear y colocar tareas puntuales', () => {
  it('nace sin colocar: el dia y la hora los decide el arrastre', async () => {
    const created = await createTask({ text: 'Llamar', weekId: WEEK })
    expect(created.day).toBeNull()
    expect(created.startBlock).toBeNull()
    expect(isFromBank(created)).toBe(false)
  })

  it('admite duracion al crearla', async () => {
    const created = await createTask({ text: 'Llamar', weekId: WEEK, estimatedMinutes: 45 })
    expect(created.estimatedMinutes).toBe(45)
  })

  it('el arrastre fija dia y hora, y devolverla a la caja se los quita', async () => {
    const id = await place('Llamar', WEEK, 3, 20)
    let moved = await db.plannerTasks.get(id)
    expect(moved?.day).toBe(3)
    expect(moved?.startBlock).toBe(20)

    await moveTask(id, null, 20)
    moved = await db.plannerTasks.get(id)
    expect(moved?.day).toBeNull()
    expect(moved?.startBlock).toBeNull()
  })

  it('exige texto y rechaza duraciones imposibles', async () => {
    await expect(createTask({ text: '  ', weekId: WEEK })).rejects.toThrow(/texto/)
    await expect(createTask({ text: 'X', weekId: WEEK, estimatedMinutes: 1e10 })).rejects.toThrow(
      /Duracion|Duración/,
    )
  })

  it('editar cambia texto, duracion y colocacion en una sola escritura', async () => {
    const created = await createTask({ text: 'Llamar', weekId: WEEK, estimatedMinutes: 60 })
    await updateTask(created.id, {
      text: 'Llamar al fontanero',
      estimatedMinutes: null,
      day: 2,
      startBlock: 20,
    })
    const updated = await db.plannerTasks.get(created.id)
    expect(updated?.text).toBe('Llamar al fontanero')
    expect(updated?.day).toBe(2)
    expect(updated === undefined ? true : 'estimatedMinutes' in updated).toBe(false)
  })
})

describe('la semana no arrastra nada', () => {
  it('una semana nueva empieza vacia: no se recrea nada solo', async () => {
    const item = await createBankTask({ text: 'Gimnasio' })
    await createTaskFromBank(item, WEEK, 4, 38)
    await ensureWeekReady(NEXT, NEXT)
    expect(await textsOf(NEXT)).toEqual([])
  })
})

describe('ensureWeekReady — las puntuales solo viven su semana', () => {
  it('borra las puntuales sin hacer de semanas anteriores al abrir la actual', async () => {
    const id = await place('Llamar', '2026-W28', 3, 20)
    await ensureWeekReady(WEEK, WEEK)
    expect(await db.plannerTasks.get(id)).toBeUndefined()
  })

  it('conserva lo que sí hiciste: es el historial de la semana', async () => {
    const id = await place('Informe', PREV, 2, 20)
    await toggleTaskDone(id)
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(PREV)).toEqual(['Informe'])
  })

  it('conserva lo que salio del banco, aunque quedara sin hacer', async () => {
    // Es el registro de que ese jueves no fuiste al gimnasio.
    const item = await createBankTask({ text: 'Gimnasio' })
    await createTaskFromBank(item, PREV, 4, 38)
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(PREV)).toEqual(['Gimnasio'])
  })

  it('el borrado se encola para que el otro dispositivo también la pierda', async () => {
    await place('Llamar', PREV, 3, 20)
    await db.outbox.clear()
    await ensureWeekReady(WEEK, WEEK)
    const queued = await db.outbox.toArray()
    expect(queued.filter((entry) => entry.op === 'delete')).toHaveLength(1)
  })

  it('la purga deja intacto lo del banco de esa misma semana', async () => {
    const item = await createBankTask({ text: 'Gimnasio' })
    await createTaskFromBank(item, PREV, 4, 38)
    await place('Llamar', PREV, 3, 20)
    await ensureWeekReady(WEEK, WEEK)
    expect(await textsOf(PREV)).toEqual(['Gimnasio'])
  })
})

describe('cola de subida', () => {
  it('cada escritura encola su fila en la misma transacción', async () => {
    await db.outbox.clear()
    const created = await createTask({ text: 'Llamar', weekId: WEEK })
    await toggleTaskDone(created.id)

    const queued = await db.outbox.toArray()
    expect(queued.every((entry) => entry.table === 'plannerTasks')).toBe(true)
    expect(queued.filter((entry) => entry.rowId === created.id)).toHaveLength(2)
  })

  it('sacar del banco tambien encola', async () => {
    const item = await createBankTask({ text: 'Gimnasio' })
    await db.outbox.clear()
    await createTaskFromBank(item, WEEK, 4, 38)
    const queued = await db.outbox.toArray()
    expect(queued.filter((entry) => entry.table === 'plannerTasks')).toHaveLength(1)
  })
})

describe('el invariante de colocación — día y hora van juntos', () => {
  it('quitarle la hora a una tarea colocada la devuelve entera a la caja', async () => {
    // El fallo que arregla esto la dejaba con día y sin hora: fuera de la caja
    // (filtra por día) y fuera de la cuadrícula (filtra por hora). Invisible.
    const id = await place('Llamar', WEEK, 4, 20)
    await updateTask(id, { startBlock: null })
    const [task] = await listWeekTasks(WEEK)
    expect(task?.day).toBeNull()
    expect(task?.startBlock).toBeNull()
  })

  it('poner día y «sin hora» a la vez tampoco deja la mitad suelta', async () => {
    const created = await createTask({ text: 'Llamar', weekId: WEEK })
    await updateTask(created.id, { day: 4, startBlock: null })
    const [task] = await listWeekTasks(WEEK)
    expect(task?.day).toBeNull()
    expect(task?.startBlock).toBeNull()
  })

  it('moveTask con día y sin bloque devuelve la tarea a la caja', async () => {
    const id = await place('Llamar', WEEK, 4, 20)
    await moveTask(id, 4, null)
    const [task] = await listWeekTasks(WEEK)
    expect(task?.day).toBeNull()
    expect(task?.startBlock).toBeNull()
  })

  it('dar hora a una tarea sin día no la coloca a medias', async () => {
    const created = await createTask({ text: 'Llamar', weekId: WEEK })
    await updateTask(created.id, { startBlock: 20 })
    const [task] = await listWeekTasks(WEEK)
    expect(task?.day).toBeNull()
    expect(task?.startBlock).toBeNull()
  })

  it('sacar del banco sin día deja la tarea en la caja, no colgando de una hora', async () => {
    const item = await createBankTask({ text: 'Gimnasio' })
    await createTaskFromBank(item, WEEK, null, 20)
    const [task] = await listWeekTasks(WEEK)
    expect(task?.day).toBeNull()
    expect(task?.startBlock).toBeNull()
  })
})

describe('duraciones que el servidor no aceptaría', () => {
  it('rechaza los decimales: la columna remota es integer', async () => {
    await expect(createTask({ text: 'Leer', weekId: WEEK, estimatedMinutes: 20.5 })).rejects.toThrow(
      /Duración/,
    )
    const id = await place('Llamar', WEEK, 4, 20)
    await expect(updateTask(id, { estimatedMinutes: 20.5 })).rejects.toThrow(/Duración/)
  })

  it('rechaza cero y negativos', async () => {
    await expect(createTask({ text: 'Leer', weekId: WEEK, estimatedMinutes: 0 })).rejects.toThrow()
    await expect(createTask({ text: 'Leer', weekId: WEEK, estimatedMinutes: -5 })).rejects.toThrow()
  })

  it('una ficha del banco corrupta no contamina la tarea que sale de ella', async () => {
    // Puede llegar de un import JSON o de una fila remota vieja: el banco no es
    // la única puerta de entrada a la tabla.
    await expect(
      createTaskFromBank({ id: 'x', text: 'Leer', estimatedMinutes: 20.5 }, WEEK, 4, 20),
    ).rejects.toThrow(/Duración/)
    expect(await listWeekTasks(WEEK)).toEqual([])
  })
})

describe('escrituras que no deben tocar nada', () => {
  it('escribir sobre un id que no existe no encola basura', async () => {
    await db.outbox.clear()
    await updateTask('fantasma', { text: 'Nada' })
    await moveTask('fantasma', 3, 20)
    await toggleTaskDone('fantasma')
    expect(await db.outbox.toArray()).toEqual([])
  })

  it('abrir una semana pasada no purga nada', async () => {
    await place('Llamar', PREV, 3, 20)
    await ensureWeekReady(PREV, WEEK)
    expect(await textsOf(PREV)).toEqual(['Llamar'])
  })

  it('borrar quita la fila y encola el borrado', async () => {
    const id = await place('Llamar', WEEK, 3, 20)
    await db.outbox.clear()
    await deleteTask(id)
    expect(await listWeekTasks(WEEK)).toEqual([])
    const queued = await db.outbox.toArray()
    expect(queued).toHaveLength(1)
    expect(queued[0]?.op).toBe('delete')
  })

  it('editar la ficha del banco no reescribe lo que ya estaba colocado', async () => {
    const item = await createBankTask({ text: 'Gimnasio', estimatedMinutes: 60 })
    await createTaskFromBank(item, WEEK, 4, 38)
    await updateBankTask(item.id, { text: 'Gimnasio (nuevo)', estimatedMinutes: 90 })
    const [task] = await listWeekTasks(WEEK)
    expect(task?.text).toBe('Gimnasio')
    expect(task?.estimatedMinutes).toBe(60)
  })
})
