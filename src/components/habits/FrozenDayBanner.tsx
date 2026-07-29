import { NavLink } from 'react-router'
import { unfreezeExactDay } from '../../data/repositories/frozenRepo'
import { NoticeBanner } from '../ui/NoticeBanner'
import { NOTICE_ACTION } from '../ui/classes'
import type { IsoDate } from '../../logic/dates'

interface FrozenDayBannerProps {
  date: IsoDate
  /** true si el día lo cubre un rango de exactamente ese día (descongelable aquí). */
  canQuickUnfreeze: boolean
}

/** Estado de día congelado: ni suma ni rompe. */
export function FrozenDayBanner({ date, canQuickUnfreeze }: FrozenDayBannerProps) {
  return (
    <NoticeBanner
      className="mt-4"
      title="Día congelado"
      detail="Ni suma ni rompe: no cuenta para rachas ni porcentajes."
      actions={
        canQuickUnfreeze ? (
          <button
            type="button"
            onClick={() => void unfreezeExactDay(date)}
            className={NOTICE_ACTION}
          >
            Descongelar este día
          </button>
        ) : (
          <NavLink to="/habitos" className={NOTICE_ACTION}>
            Pertenece a un rango congelado: gestionarlo en Hábitos
          </NavLink>
        )
      }
    />
  )
}
