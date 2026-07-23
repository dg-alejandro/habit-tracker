import { addDaysIso, formatDateEs, relativeDayLabel, type IsoDate } from '../../logic/dates'

interface DayNavigatorProps {
  date: IsoDate
  today: IsoDate
  onChange: (date: IsoDate) => void
}

/**
 * Fecha registrada con flechas para navegar. Hacia atrás sin límite (se pueden
 * rellenar días pasados); hacia delante nunca más allá del día lógico actual.
 */
export function DayNavigator({ date, today, onChange }: DayNavigatorProps) {
  const atToday = date >= today
  const label = relativeDayLabel(date, today)

  return (
    <nav aria-label="Cambiar de día" className="mt-6 flex items-center justify-between gap-3">
      <button
        type="button"
        aria-label="Día anterior"
        onClick={() => onChange(addDaysIso(date, -1))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:bg-surface active:bg-surface"
      >
        <Chevron direction="left" />
      </button>

      <div className="min-w-0 text-center">
        <p className="truncate text-base font-semibold capitalize text-ink">{label ?? formatDateEs(date)}</p>
        {label !== null && <p className="truncate text-xs text-ink-soft">{formatDateEs(date)}</p>}
      </div>

      <button
        type="button"
        aria-label="Día siguiente"
        disabled={atToday}
        onClick={() => onChange(addDaysIso(date, 1))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:bg-surface active:bg-surface disabled:opacity-30 disabled:hover:bg-paper"
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
