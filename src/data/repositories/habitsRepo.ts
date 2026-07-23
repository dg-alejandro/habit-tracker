/*
 * Acceso a datos de hábitos. Los repositorios estampan updatedAt/createdOn
 * ellos mismos: la regla de inyección de tiempo solo ata a `src/logic/`.
 */
import { db } from '../db'
import { logicalDateOf } from '../../logic/dates'
import { DEFAULT_WEEKLY_TARGET, type Habit, type HabitType } from '../types'

export interface CreateHabitInput {
  name: string
  type: HabitType
  /** Obligatorio para contadores; se ignora en casillas. */
  targetMinutes?: number
  weeklyTarget?: number
}

/** El tipo no se puede editar: cambiarlo corrompería el significado del historial. */
export interface UpdateHabitPatch {
  name?: string
  targetMinutes?: number
  weeklyTarget?: number
}

/** Todos los hábitos, archivados incluidos, por orden de lista. */
export function listAllHabits(): Promise<Habit[]> {
  return db.habits.orderBy('order').toArray()
}

/** Solo los activos, por orden de lista. */
export async function listActiveHabits(): Promise<Habit[]> {
  const all = await db.habits.orderBy('order').toArray()
  return all.filter((habit) => habit.archivedAt === null)
}

export function createHabit(input: CreateHabitInput): Promise<Habit> {
  // La UI ya lo impide; el repo lo garantiza también para el import JSON futuro.
  if (input.type !== 'check' && (input.targetMinutes === undefined || input.targetMinutes <= 0)) {
    throw new Error('Un contador necesita un objetivo en minutos mayor que cero')
  }
  return db.transaction('rw', db.habits, async () => {
    const habit: Habit = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      type: input.type,
      weeklyTarget: input.weeklyTarget ?? DEFAULT_WEEKLY_TARGET,
      order: await nextOrder(),
      createdOn: logicalDateOf(new Date()),
      archivedAt: null,
      updatedAt: Date.now(),
    }
    if (input.type !== 'check' && input.targetMinutes !== undefined) {
      habit.targetMinutes = input.targetMinutes
    }
    await db.habits.add(habit)
    return habit
  })
}

export async function updateHabit(id: string, patch: UpdateHabitPatch): Promise<void> {
  const changes: Partial<Habit> = { updatedAt: Date.now() }
  if (patch.name !== undefined) changes.name = patch.name.trim()
  if (patch.targetMinutes !== undefined) changes.targetMinutes = patch.targetMinutes
  if (patch.weeklyTarget !== undefined) changes.weeklyTarget = patch.weeklyTarget
  await db.habits.update(id, changes)
}

export async function archiveHabit(id: string): Promise<void> {
  const now = Date.now()
  await db.habits.update(id, { archivedAt: now, updatedAt: now })
}

/** Desarchivar reincorpora el hábito al final de la lista. */
export async function unarchiveHabit(id: string): Promise<void> {
  await db.transaction('rw', db.habits, async () => {
    await db.habits.update(id, { archivedAt: null, order: await nextOrder(), updatedAt: Date.now() })
  })
}

/** Fija el orden 0..n-1 según la lista recibida (solo activos; los archivados conservan el suyo). */
export async function reorderHabits(orderedActiveIds: readonly string[]): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.habits, async () => {
    await Promise.all(
      orderedActiveIds.map((id, index) => db.habits.update(id, { order: index, updatedAt: now })),
    )
  })
}

async function nextOrder(): Promise<number> {
  const last = await db.habits.orderBy('order').last()
  return last === undefined ? 0 : last.order + 1
}
