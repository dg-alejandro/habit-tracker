/*
 * Tests del día lógico y del calendario. Los instantes se construyen siempre
 * en UTC y las expectativas están en hora de pared de Madrid:
 * CET = UTC+1 (invierno), CEST = UTC+2 (verano).
 * DST de Madrid en 2026: 29-mar (02:00→03:00) y 25-oct (03:00→02:00), a la 01:00 UTC.
 * La suite corre bajo TZ=America/New_York (vite.config.ts) para probar que nada
 * depende de la zona horaria del dispositivo.
 */
import { describe, expect, it } from 'vitest'
import {
  addDaysIso,
  formatDateEs,
  isDateFrozen,
  isoWeekDaysOf,
  isoWeekIdOf,
  logicalDateOf,
  madridWallClock,
  relativeDayLabel,
} from './dates'

/** Instante UTC con mes 1–12, para leer igual que las fechas ISO. */
function utc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

describe('madridWallClock', () => {
  it('convierte un instante de verano a la pared de Madrid (CEST, +2)', () => {
    expect(madridWallClock(utc(2026, 7, 23, 20, 0))).toEqual({ year: 2026, month: 7, day: 23, hour: 22 })
  })

  it('convierte un instante de invierno a la pared de Madrid (CET, +1)', () => {
    expect(madridWallClock(utc(2026, 1, 15, 20, 0))).toEqual({ year: 2026, month: 1, day: 15, hour: 21 })
  })

  it('a medianoche la hora es 0, nunca 24', () => {
    expect(madridWallClock(utc(2026, 7, 23, 22, 0))).toEqual({ year: 2026, month: 7, day: 24, hour: 0 })
  })
})

describe('logicalDateOf — corte a las 4:00', () => {
  it('una noche normal pertenece a su propio día', () => {
    // 22:00 de Madrid del 23 de julio.
    expect(logicalDateOf(utc(2026, 7, 23, 20, 0))).toBe('2026-07-23')
  })

  it('la 1:00 de la madrugada pertenece al día anterior', () => {
    // 01:00 de Madrid del 23 de julio.
    expect(logicalDateOf(utc(2026, 7, 22, 23, 0))).toBe('2026-07-22')
  })

  it('medianoche en Madrid pertenece al día anterior', () => {
    expect(logicalDateOf(utc(2026, 7, 23, 22, 0))).toBe('2026-07-23')
  })

  it('borde exacto en invierno: 3:59:59 es ayer, 4:00:00 ya es hoy', () => {
    expect(logicalDateOf(utc(2026, 1, 15, 2, 59, 59))).toBe('2026-01-14') // 03:59:59 CET
    expect(logicalDateOf(utc(2026, 1, 15, 3, 0, 0))).toBe('2026-01-15') // 04:00:00 CET
  })

  it('borde exacto en verano: 3:59:59 es ayer, 4:00:00 ya es hoy', () => {
    expect(logicalDateOf(utc(2026, 7, 24, 1, 59, 59))).toBe('2026-07-23') // 03:59:59 CEST
    expect(logicalDateOf(utc(2026, 7, 24, 2, 0, 0))).toBe('2026-07-24') // 04:00:00 CEST
  })

  it('un instante UTC que ya es mañana en Madrid usa la fecha de Madrid', () => {
    // 23:30 UTC del 15-ene = 00:30 de Madrid del 16-ene → día lógico 15-ene.
    expect(logicalDateOf(utc(2026, 1, 15, 23, 30))).toBe('2026-01-15')
  })

  it('cambio al horario de verano (29-mar-2026, la hora 02:xx no existe)', () => {
    expect(logicalDateOf(utc(2026, 3, 29, 0, 30))).toBe('2026-03-28') // 01:30 CET
    expect(logicalDateOf(utc(2026, 3, 29, 1, 30))).toBe('2026-03-28') // 03:30 CEST (saltó de 02:00 a 03:00)
    expect(logicalDateOf(utc(2026, 3, 29, 2, 0))).toBe('2026-03-29') // 04:00 CEST
  })

  it('cambio al horario de invierno (25-oct-2026, la hora 02:xx se repite)', () => {
    expect(logicalDateOf(utc(2026, 10, 25, 0, 30))).toBe('2026-10-24') // 02:30 CEST, primera vez
    expect(logicalDateOf(utc(2026, 10, 25, 1, 30))).toBe('2026-10-24') // 02:30 CET, segunda vez
    expect(logicalDateOf(utc(2026, 10, 25, 2, 59))).toBe('2026-10-24') // 03:59 CET
    expect(logicalDateOf(utc(2026, 10, 25, 3, 0))).toBe('2026-10-25') // 04:00 CET
  })

  it('cruza el límite de año: la madrugada del 1 de enero es del 31 de diciembre', () => {
    expect(logicalDateOf(utc(2026, 1, 1, 0, 30))).toBe('2025-12-31') // 01:30 CET del 1-ene
    expect(logicalDateOf(utc(2025, 12, 31, 23, 30))).toBe('2025-12-31') // 00:30 CET del 1-ene
  })

  it('cruza el límite de mes en año bisiesto: la madrugada del 1-mar-2024 es del 29-feb', () => {
    expect(logicalDateOf(utc(2024, 3, 1, 0, 30))).toBe('2024-02-29') // 01:30 CET
  })
})

describe('addDaysIso', () => {
  it('cruza límites de mes y de año', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('respeta los años bisiestos', () => {
    expect(addDaysIso('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysIso('2023-02-28', 1)).toBe('2023-03-01')
  })

  it('ida y vuelta de una semana es identidad', () => {
    expect(addDaysIso(addDaysIso('2026-07-23', 7), -7)).toBe('2026-07-23')
  })

  it('la aritmética de calendario es inmune a los días de 23 horas (DST)', () => {
    expect(addDaysIso('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDaysIso('2026-10-24', 2)).toBe('2026-10-26')
  })
})

describe('isoWeekIdOf', () => {
  it('semana normal de mitad de año', () => {
    expect(isoWeekIdOf('2026-07-23')).toBe('2026-W30')
  })

  it('el 1 de enero de 2026 (jueves) cae en la W01 de 2026', () => {
    expect(isoWeekIdOf('2026-01-01')).toBe('2026-W01')
  })

  it('los últimos días de diciembre pueden pertenecer a la W01 del año siguiente', () => {
    expect(isoWeekIdOf('2025-12-29')).toBe('2026-W01')
  })

  it('el 1 de enero puede pertenecer a la W53 del año anterior', () => {
    expect(isoWeekIdOf('2021-01-01')).toBe('2020-W53')
    expect(isoWeekIdOf('2021-01-04')).toBe('2021-W01')
  })

  it('2026 tiene W53 y se extiende hasta enero de 2027', () => {
    expect(isoWeekIdOf('2026-12-28')).toBe('2026-W53')
    expect(isoWeekIdOf('2027-01-03')).toBe('2026-W53')
  })

  it('las semanas de un dígito llevan cero a la izquierda', () => {
    expect(isoWeekIdOf('2026-02-10')).toBe('2026-W07')
  })
})

describe('isoWeekDaysOf', () => {
  it('devuelve los 7 días de lunes a domingo', () => {
    expect(isoWeekDaysOf('2026-07-23')).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
    ])
  })

  it('un lunes abre su propia semana y un domingo la cierra', () => {
    expect(isoWeekDaysOf('2026-07-20')[0]).toBe('2026-07-20')
    expect(isoWeekDaysOf('2026-07-26')[0]).toBe('2026-07-20')
    expect(isoWeekDaysOf('2026-07-26')[6]).toBe('2026-07-26')
  })

  it('cruza el límite de mes', () => {
    expect(isoWeekDaysOf('2026-07-31')).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ])
  })

  it('cruza el límite de año', () => {
    expect(isoWeekDaysOf('2026-01-01')).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ])
  })
})

describe('isDateFrozen', () => {
  const range = { startDate: '2026-07-10', endDate: '2026-07-15' }

  it('dentro del rango y en ambos bordes (inclusivos)', () => {
    expect(isDateFrozen('2026-07-12', [range])).toBe(true)
    expect(isDateFrozen('2026-07-10', [range])).toBe(true)
    expect(isDateFrozen('2026-07-15', [range])).toBe(true)
  })

  it('fuera del rango por ambos lados', () => {
    expect(isDateFrozen('2026-07-09', [range])).toBe(false)
    expect(isDateFrozen('2026-07-16', [range])).toBe(false)
  })

  it('un rango de un solo día congela exactamente ese día', () => {
    const single = { startDate: '2026-07-23', endDate: '2026-07-23' }
    expect(isDateFrozen('2026-07-23', [single])).toBe(true)
    expect(isDateFrozen('2026-07-22', [single])).toBe(false)
    expect(isDateFrozen('2026-07-24', [single])).toBe(false)
  })

  it('con rangos solapados basta con que uno cubra la fecha', () => {
    const other = { startDate: '2026-07-14', endDate: '2026-07-20' }
    expect(isDateFrozen('2026-07-18', [range, other])).toBe(true)
    expect(isDateFrozen('2026-07-21', [range, other])).toBe(false)
  })

  it('sin rangos no hay días congelados', () => {
    expect(isDateFrozen('2026-07-23', [])).toBe(false)
  })
})

describe('relativeDayLabel', () => {
  it("distingue 'hoy', 'ayer' y el resto", () => {
    expect(relativeDayLabel('2026-07-23', '2026-07-23')).toBe('hoy')
    expect(relativeDayLabel('2026-07-22', '2026-07-23')).toBe('ayer')
    expect(relativeDayLabel('2026-07-21', '2026-07-23')).toBeNull()
    expect(relativeDayLabel('2026-07-24', '2026-07-23')).toBeNull()
  })

  it('funciona cruzando el límite de mes', () => {
    expect(relativeDayLabel('2026-07-31', '2026-08-01')).toBe('ayer')
  })
})

describe('formatDateEs', () => {
  it('formatea en español con día de la semana, día y mes', () => {
    // Por substrings: la puntuación exacta de ICU varía entre versiones de Node.
    const text = formatDateEs('2026-07-23')
    expect(text).toContain('jueves')
    expect(text).toContain('23')
    expect(text).toContain('julio')
  })
})
