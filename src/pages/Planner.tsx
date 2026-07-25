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
import { HOUR_RAIL_WIDTH, HourGrid } from '../components/planner/HourGrid'
import { MobileDayPager } from '../components/planner/MobileDayPager'
import { TaskChip } from '../components/planner/TaskChip'
import { TaskEditor } from '../components/planner/TaskEditor'
import { UnplacedTray } from '../components/planner/UnplacedTray'
import { WeekNavigator } from '../components/planner/WeekNavigator'
import { moveTask } from '../data/repositories/plannerTasksRepo'
import { useIsDesktop, useWeekPreparation, useWeekTasks } from '../hooks/usePlanner'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { daysOfWeekId, isoWeekIdOf, isoWeekdayOf, type WeekId } from '../logic/dates'
import {
  applyTaskMove,
  countPendingByDay,
  groupTasksByDay,
  parseDropTargetId,
  placementFor,
  scheduledTasksByDay,
  unplacedTasks,
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
 * Toda tarea vive dentro de un día: no hay bandeja intermedia. Las fijas salen
 * de una ficha con varios días; las breves solo viven la semana en curso.
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
  const unplaced = useMemo(() => unplacedTasks(tasks ?? []), [tasks])
  const byDay = useMemo(() => groupTasksByDay(tasks ?? []), [tasks])
  const pendingByDay = useMemo(() => countPendingByDay(byDay), [byDay])
  const scheduledByDay = useMemo(() => scheduledTasksByDay(byDay), [byDay])
  const pendingTotal = (tasks ?? []).filter((task) => !task.done).length

  const closeEdit = () => setEditingId(null)

  const onDragStart = (event: DragStartEvent) => setDragging(String(event.active.id))

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null)
    const { active, over } = event
    if (over === null) return
    const target = parseDropTargetId(String(over.id))
    if (target === null) return
    const id = String(active.id)
    const { day, startBlock } = placementFor(target)
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
      <div className="mx-auto max-w-xl px-5 py-6 md:max-w-6xl md:px-8 md:py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-3">
          <h1 className="font-display text-2xl uppercase tracking-widest text-ink">
            Planificador
          </h1>
          <div className="flex items-baseline gap-4">
            {pendingTotal > 0 && (
              <span className="font-display text-xs uppercase tracking-widest text-streak-orange">
                {pendingTotal} pendientes
              </span>
            )}
            <Link
              to="/planificador/fijas"
              className="font-display text-xs uppercase tracking-widest text-ink-soft transition-colors hover:text-streak-lime"
            >
              Tareas fijas
            </Link>
          </div>
        </div>

        <WeekNavigator weekId={weekId} currentWeekId={currentWeekId} onChange={setWeekId} />

        <UnplacedTray
          weekId={weekId}
          tasks={unplaced}
          editingId={editingId}
          onEdit={setEditingId}
        />

        {/* El editor vive aquí, a ancho completo: en escritorio una columna de
            día es un séptimo de la pantalla y el formulario no cabría dentro. */}
        {editing !== undefined && (
          <div className="mt-4">
            <TaskEditor key={editing.id} task={editing} onClose={closeEdit} />
          </div>
        )}

        {!isDesktop && (
          <MobileDayPager
            selected={selectedDay}
            today={todayWeekday}
            pendingByDay={pendingByDay}
            onSelect={setSelectedDay}
          />
        )}

        {/* Misma plantilla de columnas que la cuadrícula de abajo, hueco del
            raíl horario incluido: las dos rejillas tienen que cuadrar. */}
        <div
          className={isDesktop ? 'mt-6 grid' : 'mt-6'}
          style={
            isDesktop
              ? { gridTemplateColumns: `${HOUR_RAIL_WIDTH} repeat(${visibleDays.length}, minmax(0, 1fr))` }
              : undefined
          }
        >
          {isDesktop && <div />}
          {visibleDays.map((day) => (
            <DayLane
              key={day}
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
          todayWeekday={todayWeekday}
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

        {/* Imprescindible: las listas y la cuadrícula son contenedores
            distintos, y sin capa flotante no se puede arrastrar de una a otra. */}
        <DragOverlay dropAnimation={null}>
          {draggingTask === undefined ? null : (
            <div className="w-64 rounded-sm border border-streak-lime bg-surface px-2 opacity-90">
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
