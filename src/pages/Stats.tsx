import { useState } from 'react'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { useStatsData } from '../hooks/useStatsData'
import { GlobalStatsView } from '../components/stats/GlobalStatsView'
import { HabitStatsView } from '../components/stats/HabitStatsView'

/*
 * Rachas y estadísticas (CLAUDE.md §5.3). Es donde los chillones pesan más,
 * pero desde el rediseño del 2026-07-25 ya no son exclusivos de aquí (§6).
 * Dos vistas con estado local: la global y el detalle de un hábito.
 */
export function Stats() {
  const today = useLogicalToday()
  const data = useStatsData(today)
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null)

  const selected = data?.habits.find((habit) => habit.id === selectedHabitId) ?? null

  return (
    <div className="mx-auto max-w-xl px-5 py-6 md:px-10 md:py-10">
      {data === undefined ? (
        <h1 className="font-display text-2xl uppercase tracking-widest text-ink">Rachas y estadísticas</h1>
      ) : selected === null ? (
        <GlobalStatsView data={data} today={today} onSelectHabit={setSelectedHabitId} />
      ) : (
        <HabitStatsView
          key={selected.id}
          habit={selected}
          data={data}
          today={today}
          onBack={() => setSelectedHabitId(null)}
        />
      )}
    </div>
  )
}
