/*
 * Día lógico y calendario de la app. Funciones puras: el instante siempre
 * se inyecta como `Date`; aquí no hay `Date.now()` ni acceso a nada externo.
 *
 * Reglas de negocio (CLAUDE.md §3):
 * - El día cierra a las 4:00: marcar a la 1:00 cuenta como el día anterior.
 * - Zona horaria fija Europe/Madrid, independiente del dispositivo.
 * - Semana ISO, de lunes a domingo.
 */
import { addDays, format, startOfISOWeek } from 'date-fns'

/**
 * Fecha de calendario 'YYYY-MM-DD'.
 * Contrato: se compara como string — el orden lexicográfico es el cronológico.
 * No existe (ni debe existir) un helper de comparación.
 */
export type IsoDate = string

/** Identificador de semana ISO, p. ej. '2026-W31'. */
export type WeekId = string

/** Hora a la que cierra el día lógico: antes de las 4:00 se cuenta el día anterior. */
export const LOGICAL_DAY_CUTOFF_HOUR = 4

/** Zona horaria fija de la app. */
export const APP_TIME_ZONE = 'Europe/Madrid'

/** Reloj de pared: componentes de fecha y hora tal y como se ven en Madrid. */
export interface WallClock {
  year: number
  /** 1–12 */
  month: number
  /** 1–31 */
  day: number
  /** 0–23 */
  hour: number
}

/**
 * Formateador cacheado a nivel de módulo: construir un Intl.DateTimeFormat es caro.
 * `hourCycle: 'h23'` y no `hour12: false`: algunos motores devuelven la hora '24'
 * a medianoche con `hour12`, y rompería la comparación `hour < 4`.
 */
const madridFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

/** Reloj de pared de Madrid para un instante dado. Determinista: zona fija. */
export function madridWallClock(instant: Date): WallClock {
  const parts = madridFormatter.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type)
    if (part === undefined) {
      throw new Error(`Intl no devolvió la parte '${type}' de la fecha`)
    }
    return Number(part.value)
  }
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
  }
}

/**
 * Día lógico al que pertenece un instante: la fecha de pared de Madrid,
 * o el día anterior si aún no son las 4:00.
 */
export function logicalDateOf(instant: Date): IsoDate {
  const wall = madridWallClock(instant)
  const date = isoDateFrom(wall.year, wall.month, wall.day)
  return wall.hour < LOGICAL_DAY_CUTOFF_HOUR ? addDaysIso(date, -1) : date
}

/** Suma (o resta) días de calendario a una fecha ISO. */
export function addDaysIso(date: IsoDate, days: number): IsoDate {
  return format(addDays(toLocalDate(date), days), 'yyyy-MM-dd')
}

/** Semana ISO a la que pertenece la fecha: '2026-W30' (año ISO + semana con cero). */
export function isoWeekIdOf(date: IsoDate): WeekId {
  return format(toLocalDate(date), "RRRR-'W'II")
}

/** Los 7 días, de lunes a domingo, de la semana ISO que contiene la fecha. */
export function isoWeekDaysOf(date: IsoDate): IsoDate[] {
  const monday = startOfISOWeek(toLocalDate(date))
  return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'))
}

/** Rango de fechas con bordes inclusivos (estructural: le vale a FrozenRange). */
export interface DateRange {
  startDate: IsoDate
  endDate: IsoDate
}

/** true si la fecha cae dentro de ALGÚN rango (bordes inclusivos). */
export function isDateFrozen(date: IsoDate, ranges: readonly DateRange[]): boolean {
  return ranges.some((range) => range.startDate <= date && date <= range.endDate)
}

/**
 * Etiqueta relativa respecto al día LÓGICO actual. A la 1:00 de la madrugada
 * "hoy" es la fecha de ayer: intencionado, el día aún no ha cerrado.
 */
export function relativeDayLabel(date: IsoDate, today: IsoDate): 'hoy' | 'ayer' | null {
  if (date === today) return 'hoy'
  if (date === addDaysIso(today, -1)) return 'ayer'
  return null
}

const spanishFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** 'jueves, 23 de julio' — solo para mostrar en la interfaz. */
export function formatDateEs(date: IsoDate): string {
  const noon = toLocalDate(date)
  // Mediodía local: lejos de cualquier borde de medianoche al formatear.
  noon.setHours(12)
  return spanishFormatter.format(noon)
}

const spanishShortFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** '10 jul 2026' — para listas compactas, como los rangos congelados. */
export function formatDateShortEs(date: IsoDate): string {
  const noon = toLocalDate(date)
  noon.setHours(12)
  return spanishShortFormatter.format(noon)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function isoDateFrom(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/**
 * Medianoche LOCAL del día indicado, para la aritmética de calendario de date-fns.
 * Nunca `new Date('YYYY-MM-DD')`: el estándar parsea las fechas sin hora como UTC
 * y desplazaría un día en zonas horarias negativas.
 */
function toLocalDate(date: IsoDate): Date {
  const [year, month, day] = date.split('-').map(Number)
  if (
    year === undefined || Number.isNaN(year) ||
    month === undefined || Number.isNaN(month) ||
    day === undefined || Number.isNaN(day)
  ) {
    throw new Error(`Fecha ISO inválida: '${date}'`)
  }
  return new Date(year, month - 1, day)
}
