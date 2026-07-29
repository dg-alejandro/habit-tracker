import { useState } from 'react'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { useStatsData } from '../hooks/useStatsData'
import { GlobalStatsView } from '../components/stats/GlobalStatsView'
import { HabitStatsView } from '../components/stats/HabitStatsView'
import { PageTitle } from '../components/ui/PageTitle'
import { SkeletonRows } from '../components/ui/Skeleton'

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
        /* useStatsData es la consulta más pesada de la app: lee el historial
           entero desde el createdOn más antiguo. Antes aquí solo quedaba el
           título flotando sobre un hueco mudo. */
        <>
          <PageTitle>Rachas y estadísticas</PageTitle>
          <SkeletonRows className="mt-6" />
        </>
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
