import type { CSSProperties, ReactNode } from 'react'
import { toggleTaskDone } from '../../data/repositories/plannerTasksRepo'
import { formatDateShortEs, weekdayShortEs, type IsoDate } from '../../logic/dates'
import {
  BLOCKS_PER_DAY,
  NIGHT_END_BLOCK,
  blockLabel,
  countNightTasks,
  layoutDayTasks,
} from '../../logic/planner'
import { TaskChip } from './TaskChip'
import type { IsoWeekday, PlannerTask } from '../../data/types'

/** Alto de un bloque de 30 min. Con la madrugada plegada el día mide 36 filas. */
export const CELL_PX = 32

/** Ancho del raíl de horas. Lo comparte la fila de días para que las dos rejillas cuadren. */
export const HOUR_RAIL_WIDTH = '3.25rem'

/** Bloque en el que estamos ahora, para pintar la raya de la hora actual. */
export interface NowMarker {
  day: IsoWeekday
  block: number
  /** 0–1 dentro del bloque, para que la raya caiga en el minuto exacto. */
  fraction: number
}

interface HourGridProps {
  /** Los días que se pintan: los siete en escritorio, uno en móvil. */
  days: readonly IsoWeekday[]
  /** Las siete fechas de la semana, de lunes a domingo. */
  dates: readonly IsoDate[]
  /** Tareas colocadas, por día. */
  tasksByDay: ReadonlyMap<IsoWeekday, PlannerTask[]>
  todayWeekday: IsoWeekday | null
  /** null si la semana visitada no es la actual. */
  now: NowMarker | null
  nightOpen: boolean
  onToggleNight: () => void
  onOpenTask: (id: string) => void
  /**
   * Convierte una celda en zona de soltado. Recibe la geometría ya calculada
   * para que la zona sea EL propio rectángulo del bloque y no un envoltorio.
   */
  renderCell?: (
    day: IsoWeekday,
    block: number,
    className: string,
    style: CSSProperties,
  ) => ReactNode
  /** Envoltura arrastrable del chip. */
  renderTask?: (task: PlannerTask, chip: ReactNode) => ReactNode
}

/**
 * Cuadrícula horaria de 00:00 a 24:00 en bloques de 30 min (§4).
 *
 * Cada día es una columna con DOS capas: las celdas apiladas (que son las zonas
 * de soltado) y, encima, los chips en posición absoluta según `layoutDayTasks`.
 * Mezclar la colocación con `grid-row: span` no permitiría los carriles de
 * solape. Las medidas en línea son geometría calculada, no color.
 *
 * La franja 00:00–06:00 va plegada por defecto: además de que una rejilla de 48
 * bloques es ingobernable en móvil, plegarla quita el 25 % de las celdas.
 */
export function HourGrid({
  days,
  dates,
  tasksByDay,
  todayWeekday,
  now,
  nightOpen,
  onToggleNight,
  onOpenTask,
  renderCell,
  renderTask,
}: HourGridProps) {
  const firstBlock = nightOpen ? 0 : NIGHT_END_BLOCK
  const blocks = Array.from({ length: BLOCKS_PER_DAY - firstBlock }, (_, i) => firstBlock + i)
  const height = blocks.length * CELL_PX
  // Solo los días que se PINTAN: en móvil se ve uno, y anunciar lo que hay el
  // martes mientras miras el lunes sería mentir sobre una franja vacía.
  const hiddenNight = days.reduce(
    (total, day) => total + countNightTasks(tasksByDay.get(day) ?? []),
    0,
  )

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line pb-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">
          La semana
        </h2>
        <button
          type="button"
          onClick={onToggleNight}
          aria-expanded={nightOpen}
          className="flex h-11 items-center gap-2 font-display text-xs uppercase tracking-widest text-ink-soft transition-colors hover:text-ink"
        >
          <span>{nightOpen ? '— madrugada' : '+ 00:00–06:00'}</span>
          {!nightOpen && hiddenNight > 0 && (
            <span className="text-streak-orange">· {hiddenNight} sin ver</span>
          )}
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div
          className="grid min-w-full border-r border-b border-line"
          style={{ gridTemplateColumns: `${HOUR_RAIL_WIDTH} repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {/* Cabecera: esquina vacía sobre el raíl horario, y un día por columna */}
          <div className="border-b border-line" />
          {days.map((day) => (
            <div
              key={`head-${day}`}
              className={`border-b-2 border-l pb-2 pt-1 text-center font-display uppercase ${
                day === todayWeekday
                  ? 'border-b-streak-lime border-l-line bg-streak-lime/10 text-streak-lime'
                  : 'border-b-line border-l-line text-ink-soft'
              }`}
            >
              <span className="block text-sm tracking-widest">{weekdayShortEs(day)}</span>
              <span className="block truncate text-[11px] normal-case tracking-normal text-ink-faint">
                {formatDateShortEs(dates[day - 1] ?? '')}
              </span>
            </div>
          ))}

          {/* Raíl horario: una etiqueta por hora en punto */}
          <div className="relative" style={{ height }}>
            {blocks.map((block) =>
              block % 2 === 0 ? (
                <span
                  key={block}
                  className={`absolute right-2 -translate-y-1/2 font-display text-[11px] tabular-nums ${
                    block % 4 === 0 ? 'text-ink-soft' : 'text-ink-faint'
                  }`}
                  style={{ top: (block - firstBlock) * CELL_PX }}
                >
                  {blockLabel(block)}
                </span>
              ) : null,
            )}
          </div>

          {days.map((day) => {
            const placements = layoutDayTasks(tasksByDay.get(day) ?? [])
            return (
              <div
                key={day}
                className={`relative border-l border-line ${
                  day === todayWeekday ? 'bg-streak-lime/5' : ''
                }`}
                style={{ height }}
              >
                {blocks.map((block) => {
                  const onTheHour = block % 2 === 0
                  // Bandas alternas cada hora: sin ellas, 36 filas iguales son
                  // imposibles de seguir con la vista de izquierda a derecha.
                  const banded = Math.floor(block / 2) % 2 === 0
                  const className = `absolute inset-x-0 ${
                    onTheHour ? 'border-t border-line' : 'border-t border-line/30'
                  } ${banded ? 'bg-surface/40' : ''}`
                  const style = { top: (block - firstBlock) * CELL_PX, height: CELL_PX }
                  return (
                    <div key={block} className="contents">
                      {renderCell === undefined ? (
                        <div className={className} style={style} />
                      ) : (
                        renderCell(day, block, className, style)
                      )}
                    </div>
                  )
                })}

                {now !== null && now.day === day && now.block >= firstBlock && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-streak-magenta"
                    style={{ top: (now.block - firstBlock + now.fraction) * CELL_PX }}
                  />
                )}

                {placements.map((placement) => {
                  const chip = (
                    <TaskChip
                      task={placement.task}
                      density="grid"
                      onToggle={() => void toggleTaskDone(placement.task.id)}
                      onOpen={() => onOpenTask(placement.task.id)}
                    />
                  )
                  return (
                    <div
                      key={placement.task.id}
                      className="absolute px-px"
                      style={{
                        top: (placement.startBlock - firstBlock) * CELL_PX,
                        height: placement.span * CELL_PX - 2,
                        left: `${(placement.lane / placement.lanes) * 100}%`,
                        width: `${100 / placement.lanes}%`,
                        // Un chip que empieza en la madrugada plegada no se pinta.
                        display: placement.startBlock < firstBlock ? 'none' : undefined,
                      }}
                    >
                      {renderTask === undefined ? chip : renderTask(placement.task, chip)}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
