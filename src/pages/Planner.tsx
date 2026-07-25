import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DayLane } from '../components/planner/DayLane'
import { MobileDayPager } from '../components/planner/MobileDayPager'
import { WeekInbox } from '../components/planner/WeekInbox'
import { TaskEditor } from '../components/planner/TaskEditor'
import { WeekNavigator } from '../components/planner/WeekNavigator'
import { useIsDesktop, useWeekPreparation, useWeekTasks } from '../hooks/usePlanner'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { daysOfWeekId, isoWeekIdOf, isoWeekdayOf, type WeekId } from '../logic/dates'
import type { IsoWeekday, PlannerTask } from '../data/types'

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

/*
 * Planificador semanal, independiente de los hábitos (CLAUDE.md §4 y §5.4).
 * Estrictamente monocromo salvo la alarma de arrastre que §4 pide en rojo.
 */
export function Planner() {
  const today = useLogicalToday()
  const currentWeekId = isoWeekIdOf(today)
  const [weekId, setWeekId] = useState<WeekId>(currentWeekId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const isDesktop = useIsDesktop()
  const [selectedDay, setSelectedDay] = useState<IsoWeekday>(() => isoWeekdayOf(today))

  useWeekPreparation(weekId, currentWeekId)
  const tasks = useWeekTasks(weekId)

  const days = useMemo(() => daysOfWeekId(weekId), [weekId])
  const todayWeekday = weekId === currentWeekId ? isoWeekdayOf(today) : null

  const editing = (tasks ?? []).find((task) => task.id === editingId)
  const inboxTasks = (tasks ?? []).filter((task) => task.day === null)
  const byDay = useMemo(() => groupByDay(tasks ?? []), [tasks])
  const pendingByDay = useMemo(() => countPendingByDay(byDay), [byDay])

  const closeEdit = () => setEditingId(null)
  // La decisión móvil/escritorio se toma en JS, no con `hidden md:`: renderizar
  // los dos árboles duplicaría las zonas de soltado del drag & drop.
  const visibleDays = isDesktop ? WEEKDAYS : [selectedDay]

  return (
    <div className="mx-auto max-w-xl px-5 py-6 md:max-w-5xl md:px-10 md:py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Planificador</h1>
        <Link
          to="/planificador/plantillas"
          className="flex h-11 shrink-0 items-center rounded-lg px-3 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
        >
          Tareas fijas
        </Link>
      </div>

      <WeekNavigator weekId={weekId} currentWeekId={currentWeekId} onChange={setWeekId} />

      {/* El editor vive aquí, a ancho completo: en escritorio una columna de día
          es un séptimo de la pantalla y el formulario no cabría dentro. */}
      {editing !== undefined && (
        <div className="mt-4">
          <TaskEditor key={editing.id} task={editing} onClose={closeEdit} />
        </div>
      )}

      <WeekInbox
        weekId={weekId}
        tasks={inboxTasks}
        editingId={editingId}
        onEdit={setEditingId}
      />

      {!isDesktop && (
        <MobileDayPager
          selected={selectedDay}
          today={todayWeekday}
          pendingByDay={pendingByDay}
          onSelect={setSelectedDay}
        />
      )}

      <div className={`mt-6 ${isDesktop ? 'grid grid-cols-7 gap-3' : ''}`}>
        {visibleDays.map((day) => (
          <DayLane
            key={day}
            weekId={weekId}
            day={day}
            date={days[day - 1] ?? ''}
            isToday={day === todayWeekday}
            tasks={(byDay.get(day) ?? []).filter((task) => task.startBlock === null)}
            editingId={editingId}
            onEdit={setEditingId}
          />
        ))}
      </div>
    </div>
  )
}

function groupByDay(tasks: readonly PlannerTask[]): Map<IsoWeekday, PlannerTask[]> {
  const byDay = new Map<IsoWeekday, PlannerTask[]>()
  for (const task of tasks) {
    if (task.day === null) continue
    const list = byDay.get(task.day)
    if (list === undefined) byDay.set(task.day, [task])
    else list.push(task)
  }
  return byDay
}

function countPendingByDay(byDay: ReadonlyMap<IsoWeekday, PlannerTask[]>): Map<IsoWeekday, number> {
  const counts = new Map<IsoWeekday, number>()
  for (const [day, tasks] of byDay) {
    counts.set(day, tasks.filter((task) => !task.done).length)
  }
  return counts
}
