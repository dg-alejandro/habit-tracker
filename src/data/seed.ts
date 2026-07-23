/*
 * Semilla inicial: los 14 hábitos precargados de CLAUDE.md §3, en su orden.
 * Su historial empieza el día lógico de la siembra, como cualquier hábito nuevo.
 */
import { db } from './db'
import { logicalDateOf } from '../logic/dates'
import { DEFAULT_WEEKLY_TARGET, type Habit, type HabitType } from './types'

interface SeedHabit {
  name: string
  type: HabitType
  targetMinutes?: number
}

const SEED_HABITS: readonly SeedHabit[] = [
  { name: 'Leer', type: 'counter', targetMinutes: 30 },
  { name: 'Aprendizaje', type: 'counter_note', targetMinutes: 30 },
  { name: 'Gimnasio', type: 'check' },
  { name: 'Beber 3 L de agua', type: 'check' },
  { name: 'Comer sano', type: 'check' },
  { name: 'Acostarse antes de las 00:30', type: 'check' },
  { name: 'Meditar 10 min', type: 'check' },
  { name: 'Movilidad 20 min', type: 'check' },
  { name: 'Limpiar 30 min', type: 'check' },
  { name: 'Tomar suplementación', type: 'check' },
  { name: 'Sin móvil la primera hora', type: 'check' },
  { name: 'Planificar el día siguiente', type: 'check' },
  { name: 'No fumar', type: 'check' },
  { name: 'No gastar en tonterías', type: 'check' },
]

/**
 * Siembra los hábitos solo si la tabla está vacía. Idempotente: la transacción
 * serializa el doble disparo del efecto en StrictMode y la segunda pasada no hace nada.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.habits, async () => {
    if ((await db.habits.count()) > 0) return
    const now = Date.now()
    const createdOn = logicalDateOf(new Date())
    const habits = SEED_HABITS.map((seed, index) => {
      const habit: Habit = {
        id: crypto.randomUUID(),
        name: seed.name,
        type: seed.type,
        weeklyTarget: DEFAULT_WEEKLY_TARGET,
        order: index,
        createdOn,
        archivedAt: null,
        updatedAt: now,
      }
      if (seed.targetMinutes !== undefined) habit.targetMinutes = seed.targetMinutes
      return habit
    })
    await db.habits.bulkAdd(habits)
  })
}
