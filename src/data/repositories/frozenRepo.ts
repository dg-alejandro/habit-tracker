/*
 * Acceso a datos de los rangos de días congelados. Un día está congelado si
 * cae dentro de ALGÚN rango (la comprobación pura vive en logic/dates.ts).
 */
import { db } from '../db'
import type { IsoDate } from '../../logic/dates'
import type { FrozenRange } from '../types'

/** Todos los rangos, los más recientes arriba. */
export function listFrozenRanges(): Promise<FrozenRange[]> {
  return db.frozenRanges.orderBy('startDate').reverse().toArray()
}

export async function createFrozenRange(
  startDate: IsoDate,
  endDate: IsoDate,
  note?: string,
): Promise<FrozenRange> {
  if (endDate < startDate) {
    throw new Error('El final del rango no puede ser anterior al inicio')
  }
  const range: FrozenRange = {
    id: crypto.randomUUID(),
    startDate,
    endDate,
    updatedAt: Date.now(),
  }
  const trimmed = note?.trim()
  if (trimmed !== undefined && trimmed !== '') range.note = trimmed
  await db.frozenRanges.add(range)
  return range
}

export async function deleteFrozenRange(id: string): Promise<void> {
  await db.frozenRanges.delete(id)
}

/** Congelar un día suelto = rango de un solo día. */
export function freezeDay(date: IsoDate): Promise<FrozenRange> {
  return createFrozenRange(date, date)
}

/**
 * Descongela un día borrando los rangos EXACTOS de ese único día. Devuelve false
 * si no había ninguno: si el día lo cubre un rango mayor, se gestiona desde /habitos.
 */
export function unfreezeExactDay(date: IsoDate): Promise<boolean> {
  return db.transaction('rw', db.frozenRanges, async () => {
    const exact = await db.frozenRanges
      .where('startDate')
      .equals(date)
      .filter((range) => range.endDate === date)
      .toArray()
    if (exact.length === 0) return false
    await db.frozenRanges.bulkDelete(exact.map((range) => range.id))
    return true
  })
}
