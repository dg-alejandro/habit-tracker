interface WeeklyHeaderProps {
  /** undefined = cargando; null = sin celdas que contar (p. ej. semana congelada). */
  percent: number | null | undefined
}

/**
 * El dato más importante de la app: el porcentaje de cumplimiento de la semana
 * en curso, enorme y en color chillón — la única mancha de color de la pantalla.
 */
export function WeeklyHeader({ percent }: WeeklyHeaderProps) {
  return (
    <header>
      <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">Semana en curso</p>
      <p className="mt-1 text-7xl font-extrabold leading-none tracking-tighter text-streak-orange tabular-nums">
        {typeof percent === 'number' ? `${percent} %` : '—'}
      </p>
    </header>
  )
}
