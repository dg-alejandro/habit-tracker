import type { StreakResult } from '../../logic/streaks'
import { BrokenStreakNotice } from './BrokenStreakNotice'

interface StreakHeroProps {
  /** Etiqueta sobre el número: 'Racha global', 'Racha actual'… */
  label: string
  streak: StreakResult
  /** Color del número con la racha viva (el rojo de ruptura manda siempre). */
  accentClass?: string
}

/*
 * Número de racha enorme, desproporcionado a propósito (CLAUDE.md §6).
 * Rota de forma reciente: 0 en rojo cayendo + aviso. Viva: color chillón.
 */
export function StreakHero({ label, streak, accentClass = 'text-streak-lime' }: StreakHeroProps) {
  const broken = streak.recentlyBroken !== null
  return (
    <section>
      <p className="font-display text-xs uppercase tracking-widest text-ink-soft">{label}</p>
      <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
        <p
          key={broken ? 'broken' : 'alive'}
          className={`font-display text-8xl font-bold leading-none tracking-tighter tabular-nums ${
            broken ? 'streak-fall text-streak-red' : accentClass
          }`}
        >
          {streak.current}
        </p>
        <div className="pb-1.5 text-sm leading-snug">
          <p className="text-ink-soft">días seguidos</p>
          <p className="text-streak-magenta">
            <span className="font-display font-bold tabular-nums">{streak.record}</span> récord
          </p>
        </div>
      </div>
      {streak.isRecord && (
        <p className="mt-2 text-sm font-semibold text-streak-magenta">Récord en curso</p>
      )}
      {streak.recentlyBroken !== null && <BrokenStreakNotice streakBreak={streak.recentlyBroken} />}
    </section>
  )
}
