/*
 * Acceso a datos de los registros diarios. Toda escritura pasa por un upsert
 * sobre el índice único [habitId+date]: una fila por hábito y día, siempre.
 */
import { db } from '../db'
import type { IsoDate } from '../../logic/dates'
import type { DayEntry } from '../types'

export function getEntriesForDate(date: IsoDate): Promise<DayEntry[]> {
  return db.entries.where('date').equals(date).toArray()
}

/** Bordes inclusivos. Los strings ISO ordenan cronológicamente, así que el índice sirve. */
export function getEntriesBetween(start: IsoDate, end: IsoDate): Promise<DayEntry[]> {
  return db.entries.where('date').between(start, end, true, true).toArray()
}

/**
 * Marca o desmarca una casilla. Desmarcar CONSERVA la fila con done=false
 * (equivale a "sin registrar" para las estadísticas y evita tumbas en la Fase 2).
 */
export function toggleCheck(habitId: string, date: IsoDate): Promise<void> {
  return upsertEntry(habitId, date, (current) => ({
    ...preserved(current),
    done: current === undefined ? true : !current.done,
  }))
}

/**
 * Suma minutos al acumulado del día (10 + 20 = 30) y recalcula done contra el
 * objetivo VIGENTE. Editar el objetivo más adelante no reescribe el historial.
 */
export function addMinutes(
  habitId: string,
  date: IsoDate,
  delta: number,
  targetMinutes: number,
): Promise<void> {
  return upsertEntry(habitId, date, (current) => {
    const minutes = Math.max(0, (current?.minutes ?? 0) + delta)
    return {
      ...preserved(current, { skipMinutes: true }),
      minutes,
      done: targetMinutes > 0 && minutes >= targetMinutes,
    }
  })
}

/** Corrección manual: fija el total del día (0 = reset) y recalcula done. */
export function setMinutes(
  habitId: string,
  date: IsoDate,
  total: number,
  targetMinutes: number,
): Promise<void> {
  return upsertEntry(habitId, date, (current) => {
    const minutes = Math.max(0, Math.floor(total))
    return {
      ...preserved(current, { skipMinutes: true }),
      minutes,
      done: targetMinutes > 0 && minutes >= targetMinutes,
    }
  })
}

/** Guarda la nota del día (counter_note). Vacía = se elimina. No toca done ni minutes. */
export function setNote(habitId: string, date: IsoDate, note: string): Promise<void> {
  return upsertEntry(habitId, date, (current) => {
    const trimmed = note.trim()
    return {
      ...preserved(current, { skipNote: true }),
      ...(trimmed === '' ? {} : { note: trimmed }),
      done: current?.done ?? false,
    }
  })
}

type EntryFields = Omit<DayEntry, 'id' | 'habitId' | 'date' | 'updatedAt'>

async function upsertEntry(
  habitId: string,
  date: IsoDate,
  mutate: (current: DayEntry | undefined) => EntryFields,
): Promise<void> {
  await db.transaction('rw', db.entries, async () => {
    const current = await db.entries.where('[habitId+date]').equals([habitId, date]).first()
    const next: DayEntry = {
      id: current?.id ?? crypto.randomUUID(),
      habitId,
      date,
      ...mutate(current),
      updatedAt: Date.now(),
    }
    await db.entries.put(next)
  })
}

/** Copia los campos opcionales existentes para que un upsert parcial no los pierda. */
function preserved(
  current: DayEntry | undefined,
  skip: { skipMinutes?: boolean; skipNote?: boolean } = {},
): Partial<Pick<DayEntry, 'minutes' | 'note'>> {
  const out: Partial<Pick<DayEntry, 'minutes' | 'note'>> = {}
  if (skip.skipMinutes !== true && current?.minutes !== undefined) out.minutes = current.minutes
  if (skip.skipNote !== true && current?.note !== undefined) out.note = current.note
  return out
}
