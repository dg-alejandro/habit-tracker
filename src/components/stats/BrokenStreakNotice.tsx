import { formatDateShortEs } from '../../logic/dates'
import type { RecentBreak } from '../../logic/streaks'

interface BrokenStreakNoticeProps {
  streakBreak: RecentBreak
}

/*
 * El aviso de ruptura (CLAUDE.md §6): rojo, claro, sin suavizar ni esconder.
 * Es el mecanismo que hace funcionar la app.
 */
export function BrokenStreakNotice({ streakBreak }: BrokenStreakNoticeProps) {
  return (
    <div className="mt-4 rounded-lg border-2 border-streak-red px-4 py-3" role="alert">
      <p className="text-sm font-bold uppercase tracking-widest text-streak-red">Racha rota</p>
      <p className="mt-1 text-sm text-ink">
        Llevabas <strong className="font-bold text-streak-red">{streakBreak.length} días</strong>; se
        rompió el {formatDateShortEs(streakBreak.brokenOn)}. Vuelve a empezar hoy.
      </p>
    </div>
  )
}
