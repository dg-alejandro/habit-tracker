import { NavLink } from 'react-router'
import { unfreezeExactDay } from '../../data/repositories/frozenRepo'
import type { IsoDate } from '../../logic/dates'

interface FrozenDayBannerProps {
  date: IsoDate
  /** true si el día lo cubre un rango de exactamente ese día (descongelable aquí). */
  canQuickUnfreeze: boolean
}

/** Estado de día congelado: ni suma ni rompe. */
export function FrozenDayBanner({ date, canQuickUnfreeze }: FrozenDayBannerProps) {
  return (
    <div className="mt-4 rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-sm font-semibold text-ink">Día congelado</p>
      <p className="mt-0.5 text-sm text-ink-soft">
        Ni suma ni rompe: no cuenta para rachas ni porcentajes.
      </p>
      {canQuickUnfreeze ? (
        <button
          type="button"
          onClick={() => void unfreezeExactDay(date)}
          className="mt-1 inline-flex h-11 items-center text-sm font-medium text-ink underline underline-offset-2"
        >
          Descongelar este día
        </button>
      ) : (
        <NavLink
          to="/habitos"
          className="mt-1 inline-flex h-11 items-center text-sm font-medium text-ink underline underline-offset-2"
        >
          Pertenece a un rango congelado: gestionarlo en Hábitos
        </NavLink>
      )}
    </div>
  )
}
