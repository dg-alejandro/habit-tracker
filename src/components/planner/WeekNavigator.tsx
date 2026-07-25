import { addWeeksToWeekId, formatWeekRangeEs, type WeekId } from '../../logic/dates'

interface WeekNavigatorProps {
  weekId: WeekId
  currentWeekId: WeekId
  onChange: (weekId: WeekId) => void
}

/**
 * Semana visitada con flechas. A diferencia del registro diario, aquí SÍ se
 * navega al futuro: planificar por adelantado es justo el caso de uso.
 */
export function WeekNavigator({ weekId, currentWeekId, onChange }: WeekNavigatorProps) {
  const isCurrent = weekId === currentWeekId

  return (
    <nav aria-label="Cambiar de semana" className="mt-8 flex items-center justify-between gap-3">
      <button
        type="button"
        aria-label="Semana anterior"
        onClick={() => onChange(addWeeksToWeekId(weekId, -1))}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-line text-ink transition-colors hover:bg-surface active:bg-surface"
      >
        <Chevron direction="left" />
      </button>

      <div className="min-w-0 text-center">
        <p className="truncate font-display text-xl tracking-wide text-ink">{formatWeekRangeEs(weekId)}</p>
        {isCurrent ? (
          <p className="font-display text-xs text-ink-soft">Esta semana</p>
        ) : (
          <button
            type="button"
            onClick={() => onChange(currentWeekId)}
            className="inline-flex h-11 items-center font-display text-xs text-ink-soft underline-offset-2 hover:text-streak-lime hover:underline"
          >
            Volver a esta semana
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label="Semana siguiente"
        onClick={() => onChange(addWeeksToWeekId(weekId, 1))}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-line text-ink transition-colors hover:bg-surface active:bg-surface"
      >
        <Chevron direction="right" />
      </button>
    </nav>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-5 w-5 ${direction === 'right' ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 5 8 12l7 7" />
    </svg>
  )
}
