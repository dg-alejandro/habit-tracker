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
  addMonthsToMonthId,
  addWeeksToWeekId,
  dateOfWeekday,
  daysOfMonth,
  daysOfWeekId,
  eachDayIso,
  formatDateEs,
  formatMonthShortEs,
  formatWeekRangeEs,
  isDateFrozen,
  isoWeekDaysOf,
  isoWeekIdOf,
  isoWeekdayOf,
  logicalDateOf,
  madridWallClock,
  mondayOfWeekId,
  monthIdOf,
  relativeDayLabel,
  weekdayLongEs,
  weekdayShortEs,
  weeksBetweenWeekIds,
} from './dates'
import type { IsoWeekday, WeekId } from './dates'

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

  it('la aritmética de calendario es inmune a los días de 23 horas (DST de Madrid)', () => {
    expect(addDaysIso('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDaysIso('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('también es inmune al DST de la zona del DISPOSITIVO (la suite corre en America/New_York)', () => {
    // NY salta el 8-mar-2026 (día local de 23 h) y retrocede el 1-nov-2026 (25 h).
    expect(addDaysIso('2026-03-07', 2)).toBe('2026-03-09')
    expect(addDaysIso('2026-10-31', 2)).toBe('2026-11-02')
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

  it('una semana con cambio de hora LOCAL (NY, 8-mar-2026) sigue teniendo 7 días correctos', () => {
    expect(isoWeekDaysOf('2026-03-04')).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ])
  })
})

describe('isoWeekdayOf', () => {
  it('lunes es 1 y domingo es 7', () => {
    expect(isoWeekdayOf('2026-07-20')).toBe(1)
    expect(isoWeekdayOf('2026-07-26')).toBe(7)
  })

  it('funciona en una semana que cruza el año', () => {
    expect(isoWeekdayOf('2025-12-31')).toBe(3)
    expect(isoWeekdayOf('2026-01-01')).toBe(4)
  })
})

describe('mondayOfWeekId', () => {
  it('semana normal de mitad de año', () => {
    expect(mondayOfWeekId('2026-W30')).toBe('2026-07-20')
  })

  it('la W01 puede arrancar en diciembre del año anterior', () => {
    expect(mondayOfWeekId('2026-W01')).toBe('2025-12-29')
  })

  it('el ancla del 4 de enero: en 2021 la W01 empieza justo ese día (lunes)', () => {
    expect(mondayOfWeekId('2021-W01')).toBe('2021-01-04')
  })

  it('años ISO largos: 2020 y 2026 tienen W53', () => {
    expect(mondayOfWeekId('2020-W53')).toBe('2020-12-28')
    expect(mondayOfWeekId('2026-W53')).toBe('2026-12-28')
  })

  it('ida y vuelta con isoWeekIdOf en todas las semanas de 2020, 2021 y 2026', () => {
    // El test más fuerte del calendario semanal: si el ancla del 4 de enero
    // fallara en algún año, aquí saltaría.
    for (const year of [2020, 2021, 2026]) {
      const lastWeek = isoWeekIdOf(`${year}-12-28`) === `${year}-W53` ? 53 : 52
      for (let week = 1; week <= lastWeek; week += 1) {
        const weekId: WeekId = `${year}-W${String(week).padStart(2, '0')}`
        const monday = mondayOfWeekId(weekId)
        expect(isoWeekIdOf(monday)).toBe(weekId)
        // Y el lunes devuelto abre de verdad su propia semana.
        expect(isoWeekDaysOf(monday)[0]).toBe(monday)
      }
    }
  })

  it('un id mal formado lanza en vez de devolver una fecha silenciosamente errónea', () => {
    expect(() => mondayOfWeekId('2026-31')).toThrow()
    expect(() => mondayOfWeekId('2026-W')).toThrow()
    expect(() => mondayOfWeekId('2026-W1')).toThrow() // sin cero a la izquierda
    expect(() => mondayOfWeekId('2026-W00')).toThrow()
    expect(() => mondayOfWeekId('2026-W54')).toThrow()
    expect(() => mondayOfWeekId('basura')).toThrow()
  })
})

describe('addWeeksToWeekId', () => {
  it('suma y resta dentro del mismo año', () => {
    expect(addWeeksToWeekId('2026-W30', 1)).toBe('2026-W31')
    expect(addWeeksToWeekId('2026-W30', -1)).toBe('2026-W29')
  })

  it('cruza el año pasando por la W53 de 2026', () => {
    expect(addWeeksToWeekId('2026-W52', 1)).toBe('2026-W53')
    expect(addWeeksToWeekId('2026-W53', 1)).toBe('2027-W01')
  })

  it('hacia atrás cae en la W53 del año anterior', () => {
    expect(addWeeksToWeekId('2021-W01', -1)).toBe('2020-W53')
  })

  it('delta 0 es la identidad y la ida y vuelta también', () => {
    expect(addWeeksToWeekId('2026-W30', 0)).toBe('2026-W30')
    expect(addWeeksToWeekId(addWeeksToWeekId('2026-W02', 5), -5)).toBe('2026-W02')
  })

  it('es inmune al DST de la zona del DISPOSITIVO (la suite corre en America/New_York)', () => {
    // NY salta el 8-mar-2026 (día de 23 h) y retrocede el 1-nov-2026 (25 h).
    expect(addWeeksToWeekId('2026-W10', 1)).toBe('2026-W11')
    expect(addWeeksToWeekId('2026-W44', 1)).toBe('2026-W45')
  })
})

describe('daysOfWeekId y dateOfWeekday', () => {
  it('devuelve los 7 días de lunes a domingo', () => {
    expect(daysOfWeekId('2026-W30')).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
    ])
  })

  it('la W01 de 2026 cruza el año', () => {
    expect(daysOfWeekId('2026-W01')[0]).toBe('2025-12-29')
    expect(daysOfWeekId('2026-W01')[6]).toBe('2026-01-04')
  })

  it('dateOfWeekday coincide con la posición dentro de daysOfWeekId', () => {
    const days = daysOfWeekId('2026-W01')
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      expect(dateOfWeekday('2026-W01', weekday as IsoWeekday)).toBe(days[weekday - 1])
    }
  })

  it('cada día devuelve su propio índice al pasarlo por isoWeekdayOf', () => {
    const days = daysOfWeekId('2026-W30')
    days.forEach((day, index) => {
      expect(isoWeekdayOf(day)).toBe(index + 1)
    })
  })
})

describe('weeksBetweenWeekIds', () => {
  it('la misma semana son 0 y dos consecutivas son 1', () => {
    expect(weeksBetweenWeekIds('2026-W30', '2026-W30')).toBe(0)
    expect(weeksBetweenWeekIds('2026-W30', '2026-W31')).toBe(1)
  })

  it('hacia atrás es negativo', () => {
    expect(weeksBetweenWeekIds('2026-W31', '2026-W30')).toBe(-1)
  })

  it('cruzando el año ISO largo de 2020', () => {
    expect(weeksBetweenWeekIds('2020-W52', '2021-W01')).toBe(2)
  })

  it('un salto grande es coherente con addWeeksToWeekId', () => {
    expect(weeksBetweenWeekIds('2026-W10', addWeeksToWeekId('2026-W10', 52))).toBe(52)
  })
})

describe('formatWeekRangeEs', () => {
  // Se comprueba por partes: la puntuación exacta de ICU varía entre versiones de Node.
  it('dentro del mismo mes no repite el mes', () => {
    const label = formatWeekRangeEs('2026-W30')
    expect(label).toContain('20')
    expect(label).toContain('26')
    expect(label).toContain('jul')
    expect(label).toContain('2026')
    expect(label.match(/jul/g)).toHaveLength(1)
  })

  it('cruzando de mes nombra los dos meses', () => {
    const label = formatWeekRangeEs('2026-W27') // 29 jun – 5 jul
    expect(label).toContain('jun')
    expect(label).toContain('jul')
  })

  it('cruzando de año nombra los dos años', () => {
    const label = formatWeekRangeEs('2026-W01') // 29 dic 2025 – 4 ene 2026
    expect(label).toContain('2025')
    expect(label).toContain('2026')
  })
})

describe('weekdayShortEs y weekdayLongEs', () => {
  it('nombran los siete días en español', () => {
    expect(weekdayLongEs(1)).toBe('lunes')
    expect(weekdayLongEs(7)).toBe('domingo')
    expect(weekdayShortEs(1)).toContain('lun')
    expect(weekdayShortEs(7)).toContain('dom')
  })

  it('los siete nombres cortos son distintos entre sí', () => {
    const names = ([1, 2, 3, 4, 5, 6, 7] as IsoWeekday[]).map(weekdayShortEs)
    expect(new Set(names).size).toBe(7)
  })
})

describe('WeekId como string ordenable', () => {
  it('canario: el orden lexicográfico es el cronológico, también cruzando año ISO', () => {
    // Todo el planificador compara semanas con < y >; si "RRRR-'W'II" dejara de
    // llevar cero a la izquierda o de usar el año ISO, esto saltaría.
    expect('2026-W09' < '2026-W10').toBe(true)
    expect('2020-W53' < '2021-W01').toBe(true)
    expect('2025-W52' < '2026-W01').toBe(true)
    expect('2026-W53' < '2027-W01').toBe(true)
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

  it('un rango que cruza el cambio de mes congela ambos lados', () => {
    const crossing = { startDate: '2026-07-30', endDate: '2026-08-02' }
    expect(isDateFrozen('2026-07-31', [crossing])).toBe(true)
    expect(isDateFrozen('2026-08-01', [crossing])).toBe(true)
    expect(isDateFrozen('2026-07-29', [crossing])).toBe(false)
    expect(isDateFrozen('2026-08-03', [crossing])).toBe(false)
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

describe('canario de zona horaria', () => {
  it('la suite corre de verdad bajo TZ=America/New_York (si falla, la inyección de vite.config.ts quedó inerte)', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(300) // EST, UTC-5
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(240) // EDT, UTC-4
  })
})

describe('eachDayIso', () => {
  it('es inclusivo en ambos bordes', () => {
    expect(eachDayIso('2026-07-21', '2026-07-23')).toEqual(['2026-07-21', '2026-07-22', '2026-07-23'])
  })

  it('start === end devuelve un único día', () => {
    expect(eachDayIso('2026-07-23', '2026-07-23')).toEqual(['2026-07-23'])
  })

  it('start > end devuelve vacío', () => {
    expect(eachDayIso('2026-07-24', '2026-07-23')).toEqual([])
  })

  it('cruza límites de mes y de año', () => {
    expect(eachDayIso('2026-07-30', '2026-08-02')).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ])
    expect(eachDayIso('2025-12-30', '2026-01-02')).toEqual([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ])
  })

  it('los dos DST de Madrid no acortan ni alargan el rango', () => {
    expect(eachDayIso('2026-03-26', '2026-03-31')).toHaveLength(6)
    expect(eachDayIso('2026-10-23', '2026-10-27')).toHaveLength(5)
  })

  it('un año natural completo tiene 365 días (366 en bisiesto)', () => {
    expect(eachDayIso('2026-01-01', '2026-12-31')).toHaveLength(365)
    expect(eachDayIso('2028-01-01', '2028-12-31')).toHaveLength(366)
  })
})

describe('monthIdOf y addMonthsToMonthId', () => {
  it('extrae el mes natural de una fecha', () => {
    expect(monthIdOf('2026-07-23')).toBe('2026-07')
  })

  it('suma y resta meses cruzando el año', () => {
    expect(addMonthsToMonthId('2026-01', -1)).toBe('2025-12')
    expect(addMonthsToMonthId('2025-12', 1)).toBe('2026-01')
    expect(addMonthsToMonthId('2026-07', -11)).toBe('2025-08')
  })

  it('ida y vuelta es identidad', () => {
    expect(addMonthsToMonthId(addMonthsToMonthId('2026-07', 5), -5)).toBe('2026-07')
  })
})

describe('daysOfMonth', () => {
  it('meses de 31, 30 y 28 días', () => {
    expect(daysOfMonth('2026-07')).toHaveLength(31)
    expect(daysOfMonth('2026-06')).toHaveLength(30)
    expect(daysOfMonth('2026-02')).toHaveLength(28)
  })

  it('febrero bisiesto tiene 29', () => {
    const days = daysOfMonth('2028-02')
    expect(days).toHaveLength(29)
    expect(days[0]).toBe('2028-02-01')
    expect(days[28]).toBe('2028-02-29')
  })

  it('diciembre cruza al año siguiente sin perder días', () => {
    const days = daysOfMonth('2026-12')
    expect(days).toHaveLength(31)
    expect(days[30]).toBe('2026-12-31')
  })
})

describe('formatMonthShortEs', () => {
  it('etiqueta corta en español', () => {
    expect(formatMonthShortEs('2026-07')).toContain('jul')
    expect(formatMonthShortEs('2026-01')).toContain('ene')
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
