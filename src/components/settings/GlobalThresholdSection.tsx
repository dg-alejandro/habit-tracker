import { DEFAULT_GLOBAL_THRESHOLD } from '../../data/types'
import { setGlobalThreshold } from '../../data/repositories/settingsRepo'
import { requiredForThreshold } from '../../logic/streaks'
import { useSettings } from '../../hooks/useSettings'
import { useActiveHabits } from '../../hooks/useHabits'

/* Del 50 al 100 en pasos de 5; se guarda como fracción 0–1. */
const OPTIONS = Array.from({ length: 11 }, (_, index) => 50 + index * 5)

/*
 * Umbral de la racha global (CLAUDE.md §5.5). Ajustes es zona monocroma:
 * el color del dato queda para la pantalla de estadísticas.
 */
export function GlobalThresholdSection() {
  const settings = useSettings()
  const habits = useActiveHabits()
  const threshold = settings?.globalThreshold ?? DEFAULT_GLOBAL_THRESHOLD
  const percent = Math.round(threshold * 100)
  const activeCount = habits?.length ?? 0
  const required = requiredForThreshold(threshold, activeCount)

  return (
    <section className="mt-12">
      <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">Racha global</h2>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label htmlFor="global-threshold" className="text-sm text-ink">
          Umbral del día cumplido
        </label>
        <select
          id="global-threshold"
          value={percent}
          onChange={(event) => void setGlobalThreshold(Number(event.target.value) / 100)}
          className="h-11 rounded-sm border border-line bg-paper px-3 text-sm text-ink"
        >
          {OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} %
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        {activeCount > 0
          ? `Con ${activeCount} hábitos activos, un día cuenta a partir de ${required} cumplidos.`
          : 'Sin hábitos activos ahora mismo.'}
      </p>
    </section>
  )
}
