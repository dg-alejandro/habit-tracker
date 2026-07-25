import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { DayLane } from '../components/planner/DayLane'
import { DraggableTask, DropZone } from '../components/planner/DropZone'
import { DuplicateWeekButton } from '../components/planner/DuplicateWeekButton'
import { HourGrid } from '../components/planner/HourGrid'
import { MobileDayPager } from '../components/planner/MobileDayPager'
import { WeekInbox } from '../components/planner/WeekInbox'
import { TaskEditor } from '../components/planner/TaskEditor'
import { WeekNavigator } from '../components/planner/WeekNavigator'
import { TaskChip } from '../components/planner/TaskChip'
import { moveTask } from '../data/repositories/plannerTasksRepo'
import { useIsDesktop, useWeekPreparation, useWeekTasks } from '../hooks/usePlanner'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { daysOfWeekId, isoWeekIdOf, isoWeekdayOf, type WeekId } from '../logic/dates'
import {
  applyTaskMove,
  countPendingByDay,
  groupTasksByDay,
  parseDropTargetId,
  scheduledTasksByDay,
} from '../logic/planner'
import type { IsoWeekday } from '../data/types'

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

/**
 * Colocación optimista mientras la escritura aterriza: sin esto el chip vuelve
 * a su sitio de origen y salta. Mismo remedio que el reorden de hábitos.
 */
interface PendingMove {
  id: string
  day: IsoWeekday | null
  startBlock: number | null
}

/**
 * `closestCenter` engancha la celda equivocada en una rejilla de bloques de
 * 28 px: se prioriza lo que hay bajo el puntero y solo se cae al solape de
 * rectángulos cuando el puntero está fuera de toda zona.
 */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

/*
 * Planificador semanal, independiente de los hábitos (CLAUDE.md §4 y §5.4).
 * Estrictamente monocromo salvo la alarma de arrastre que §4 pide en rojo.
 */
export function Planner() {
  const today = useLogicalToday()
  const currentWeekId = isoWeekIdOf(today)
  const [weekId, setWeekId] = useState<WeekId>(currentWeekId)
  const [editingId, setEditingId] = useState<string | null>(null)
  // La madrugada arranca plegada (§4): 48 bloques enteros son ingobernables.
  const [nightOpen, setNightOpen] = useState(false)
  const isDesktop = useIsDesktop()
  const [selectedDay, setSelectedDay] = useState<IsoWeekday>(() => isoWeekdayOf(today))

  const [dragging, setDragging] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)

  useWeekPreparation(weekId, currentWeekId)
  const liveTasks = useWeekTasks(weekId)

  // MouseSensor y TouchSensor por separado, no PointerSensor: un umbral de
  // distancia con el dedo convertiría cualquier desliz sobre un chip en un
  // arrastre y mataría el scroll. Con pulsación larga, el scroll gana siempre.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  )

  const tasks = useMemo(
    () => (liveTasks === undefined ? undefined : applyTaskMove(liveTasks, pendingMove)),
    [liveTasks, pendingMove],
  )

  // El optimismo se retira en cuanto la fila viva ya dice lo mismo.
  useEffect(() => {
    if (pendingMove === null || liveTasks === undefined) return
    const live = liveTasks.find((task) => task.id === pendingMove.id)
    if (live === undefined) {
      setPendingMove(null)
      return
    }
    if (live.day === pendingMove.day && live.startBlock === pendingMove.startBlock) {
      setPendingMove(null)
    }
  }, [liveTasks, pendingMove])

  const days = useMemo(() => daysOfWeekId(weekId), [weekId])
  const todayWeekday = weekId === currentWeekId ? isoWeekdayOf(today) : null

  const editing = (tasks ?? []).find((task) => task.id === editingId)
  const draggingTask = (tasks ?? []).find((task) => task.id === dragging)
  const inboxTasks = (tasks ?? []).filter((task) => task.day === null)
  const byDay = useMemo(() => groupTasksByDay(tasks ?? []), [tasks])
  const pendingByDay = useMemo(() => countPendingByDay(byDay), [byDay])
  const scheduledByDay = useMemo(() => scheduledTasksByDay(byDay), [byDay])

  const closeEdit = () => setEditingId(null)

  const onDragStart = (event: DragStartEvent) => setDragging(String(event.active.id))

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null)
    const { active, over } = event
    if (over === null) return
    const target = parseDropTargetId(String(over.id))
    if (target === null) return
    const id = String(active.id)
    const day = target.kind === 'inbox' ? null : target.day
    const startBlock = target.kind === 'slot' ? target.block : null
    setPendingMove({ id, day, startBlock })
    void moveTask(id, day, startBlock)
    // Soltar en un día distinto en móvil: seguir a la tarea a donde ha ido.
    if (!isDesktop && day !== null) setSelectedDay(day)
  }
  // La decisión móvil/escritorio se toma en JS, no con `hidden md:`: renderizar
  // los dos árboles duplicaría las zonas de soltado del drag & drop.
  const visibleDays = isDesktop ? WEEKDAYS : [selectedDay]

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // Las 252 celdas de escritorio no se miden hasta que empieza un arrastre.
      measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
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
            density={isDesktop ? 'grid' : 'row'}
          />
        ))}
      </div>

      <HourGrid
        days={visibleDays}
        tasksByDay={scheduledByDay}
        nightOpen={nightOpen}
        onToggleNight={() => setNightOpen((open) => !open)}
        onOpenTask={setEditingId}
        renderCell={(day, block, className, style) => (
          <DropZone target={{ kind: 'slot', day, block }} className={className} style={style}>
            {null}
          </DropZone>
        )}
        renderTask={(task, chip) => (
          <DraggableTask task={task} density="grid">
            {() => chip}
          </DraggableTask>
        )}
      />

      <DuplicateWeekButton weekId={weekId} />

      {/* Imprescindible: el inbox y la cuadrícula son contenedores distintos,
          y sin capa flotante no se puede arrastrar de uno al otro. */}
      <DragOverlay dropAnimation={null}>
        {draggingTask === undefined ? null : (
          <div className="w-64 rounded-lg border border-line bg-surface px-2 opacity-90">
            <TaskChip
              task={draggingTask}
              density="row"
              onToggle={() => undefined}
              onOpen={() => undefined}
            />
          </div>
        )}
      </DragOverlay>
    </div>
    </DndContext>
  )
}
