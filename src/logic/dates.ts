/*
 * Día lógico y calendario de la app. Funciones puras: el instante siempre
 * se inyecta como `Date`; aquí no hay `Date.now()` ni acceso a nada externo.
 *
 * Reglas de negocio (CLAUDE.md §3):
 * - El día cierra a las 4:00: marcar a la 1:00 cuenta como el día anterior.
 * - Zona horaria fija Europe/Madrid, independiente del dispositivo.
 * - Semana ISO, de lunes a domingo.
 */
import { addDays, differenceInCalendarISOWeeks, format, startOfISOWeek } from 'date-fns'

/**
 * Fecha de calendario 'YYYY-MM-DD'.
 * Contrato: se compara como string — el orden lexicográfico es el cronológico.
 * No existe (ni debe existir) un helper de comparación.
 */
export type IsoDate = string

/**
 * Identificador de semana ISO, p. ej. '2026-W31'.
 * Contrato: como IsoDate, se compara como string. El formato es "RRRR-'W'II"
 * (año de NUMERACIÓN ISO + semana con cero), así que el orden lexicográfico es
 * el cronológico incluso cruzando año: '2020-W53' < '2021-W01'.
 */
export type WeekId = string

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

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

/** Día de la semana ISO de una fecha: 1 = lunes … 7 = domingo. */
export function isoWeekdayOf(date: IsoDate): IsoWeekday {
  // getISODay de date-fns haría lo mismo, pero la distancia al lunes de su propia
  // semana no depende de convenciones de librería y se lee de un vistazo.
  const days = isoWeekDaysOf(date)
  const index = days.indexOf(date)
  if (index === -1) throw new Error(`Fecha ISO inválida: '${date}'`)
  return (index + 1) as IsoWeekday
}

const WEEK_ID_PATTERN = /^(\d{4})-W(\d{2})$/

/**
 * Lunes de la semana ISO indicada. El 4 de enero cae SIEMPRE en la semana 1
 * ISO de su año, en cualquier año: es el ancla estándar y evita casos especiales.
 */
export function mondayOfWeekId(weekId: WeekId): IsoDate {
  const match = WEEK_ID_PATTERN.exec(weekId)
  if (match === null) throw new Error(`Semana ISO inválida: '${weekId}'`)
  const [, yearText, weekText] = match
  if (yearText === undefined || weekText === undefined) {
    throw new Error(`Semana ISO inválida: '${weekId}'`)
  }
  const week = Number(weekText)
  if (week < 1 || week > 53) throw new Error(`Semana ISO inválida: '${weekId}'`)
  const firstWeekMonday = startOfISOWeek(toLocalDate(`${yearText}-01-04`))
  return format(addDays(firstWeekMonday, (week - 1) * 7), 'yyyy-MM-dd')
}

/**
 * Suma (o resta) semanas a un WeekId: '2026-W53' + 1 = '2027-W01'.
 * Pasa por addDaysIso, así que hereda su inmunidad al DST del dispositivo.
 */
export function addWeeksToWeekId(weekId: WeekId, delta: number): WeekId {
  return isoWeekIdOf(addDaysIso(mondayOfWeekId(weekId), delta * 7))
}

/** Los 7 días, de lunes a domingo, de la semana ISO indicada. */
export function daysOfWeekId(weekId: WeekId): IsoDate[] {
  return isoWeekDaysOf(mondayOfWeekId(weekId))
}

/** Fecha del día `weekday` (1 = lunes … 7 = domingo) dentro de la semana indicada. */
export function dateOfWeekday(weekId: WeekId, weekday: IsoWeekday): IsoDate {
  return addDaysIso(mondayOfWeekId(weekId), weekday - 1)
}

/**
 * Semanas enteras de `from` a `to`; negativo si `to` es anterior.
 * Cuenta semanas de calendario ISO, no divisiones de milisegundos: inmune a los
 * días de 23/25 h del cambio de hora.
 */
export function weeksBetweenWeekIds(from: WeekId, to: WeekId): number {
  return differenceInCalendarISOWeeks(
    toLocalDate(mondayOfWeekId(to)),
    toLocalDate(mondayOfWeekId(from)),
  )
}

const spanishDayFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric' })
const spanishDayMonthFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
})

/**
 * Rango de la semana para la cabecera del planificador:
 * '20 – 26 jul 2026' · '29 jun – 5 jul 2026' · '29 dic 2025 – 4 ene 2026'.
 */
export function formatWeekRangeEs(weekId: WeekId): string {
  const monday = mondayOfWeekId(weekId)
  const sunday = addDaysIso(monday, 6)
  const sundayLabel = formatDateShortEs(sunday)
  if (monday.slice(0, 4) !== sunday.slice(0, 4)) {
    return `${formatDateShortEs(monday)} – ${sundayLabel}`
  }
  const mondayLabel =
    monthIdOf(monday) === monthIdOf(sunday)
      ? spanishDayFormatter.format(atNoon(monday))
      : spanishDayMonthFormatter.format(atNoon(monday))
  return `${mondayLabel} – ${sundayLabel}`
}

/** Lunes canónico de referencia para nombrar los días sin depender de una semana concreta. */
const REFERENCE_MONDAY: IsoDate = '2026-07-20'

const spanishWeekdayShortFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
const spanishWeekdayLongFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long' })

/** 'lun' — cabeceras de la cuadrícula. */
export function weekdayShortEs(weekday: IsoWeekday): string {
  return spanishWeekdayShortFormatter.format(atNoon(addDaysIso(REFERENCE_MONDAY, weekday - 1)))
}

/** 'lunes' — selector de día del editor de tarea. */
export function weekdayLongEs(weekday: IsoWeekday): string {
  return spanishWeekdayLongFormatter.format(atNoon(addDaysIso(REFERENCE_MONDAY, weekday - 1)))
}

/**
 * 'L M X J V S D' — inicial del día para tiras muy estrechas.
 * A mano y no recortando el nombre corto: en español martes y miércoles
 * empiezan igual, y la convención del calendario usa X para el miércoles.
 */
const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

export function weekdayInitialEs(weekday: IsoWeekday): string {
  return WEEKDAY_INITIALS[weekday - 1] ?? ''
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

/**
 * Identificador de mes natural 'YYYY-MM'.
 * Como IsoDate, se compara como string: el orden lexicográfico es el cronológico.
 */
export type MonthId = string

/** Todos los días de start a end, ambos inclusive; [] si start > end. */
export function eachDayIso(start: IsoDate, end: IsoDate): IsoDate[] {
  const days: IsoDate[] = []
  for (let day = start; day <= end; day = addDaysIso(day, 1)) {
    days.push(day)
  }
  return days
}

/** Mes natural al que pertenece la fecha: '2026-07'. */
export function monthIdOf(date: IsoDate): MonthId {
  return date.slice(0, 7)
}

/** Suma (o resta) meses de calendario a un MonthId. */
export function addMonthsToMonthId(id: MonthId, delta: number): MonthId {
  const [year, month] = id.split('-').map(Number)
  if (year === undefined || Number.isNaN(year) || month === undefined || Number.isNaN(month)) {
    throw new Error(`Mes inválido: '${id}'`)
  }
  const total = year * 12 + (month - 1) + delta
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`
}

/** Los días del mes natural, del 1 al 28–31 (años bisiestos incluidos). */
export function daysOfMonth(id: MonthId): IsoDate[] {
  const lastDay = addDaysIso(`${addMonthsToMonthId(id, 1)}-01`, -1)
  return eachDayIso(`${id}-01`, lastDay)
}

const spanishMonthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'short' })

/** 'jul' — etiqueta corta de mes para los ejes de las gráficas. */
export function formatMonthShortEs(id: MonthId): string {
  const noon = toLocalDate(`${id}-15`)
  noon.setHours(12)
  return spanishMonthFormatter.format(noon)
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
/** Mediodía local del día indicado: lejos de cualquier borde de medianoche al formatear. */
function atNoon(date: IsoDate): Date {
  const noon = toLocalDate(date)
  noon.setHours(12)
  return noon
}

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
