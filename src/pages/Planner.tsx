import { useEffect, useMemo, useState } from 'react'
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
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { DraggableTask, DropZone } from '../components/planner/DropZone'
import { HourGrid } from '../components/planner/HourGrid'
import { MobileDayPager } from '../components/planner/MobileDayPager'
import { TaskChip } from '../components/planner/TaskChip'
import { TaskEditor } from '../components/planner/TaskEditor'
import { UnplacedTray } from '../components/planner/UnplacedTray'
import { WeekNavigator } from '../components/planner/WeekNavigator'
import { moveTask } from '../data/repositories/plannerTasksRepo'
import { useIsDesktop, useWeekPreparation, useWeekTasks } from '../hooks/usePlanner'
import { useLogicalToday } from '../hooks/useLogicalToday'
import {
  daysOfWeekId,
  isoWeekIdOf,
  isoWeekdayOf,
  weekdayLongEs,
  type WeekId,
} from '../logic/dates'
import {
  applyTaskMove,
  blockLabel,
  countPendingByDay,
  groupTasksByDay,
  parseDropTargetId,
  placementFor,
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

/**
 * Lo que oye un lector de pantalla al arrastrar. dnd-kit trae los suyos en
 * inglés y hablando de «draggable items»; la interfaz es en español y habla de
 * tareas y de huecos.
 */
const announcements: Announcements = {
  onDragStart: () => 'Tarea agarrada. Suéltala en un hueco de la cuadrícula.',
  onDragOver: ({ over }) =>
    over === null ? 'Fuera de cualquier hueco.' : describeTarget(String(over.id)),
  onDragEnd: ({ over }) =>
    over === null ? 'Soltada fuera: la tarea no se ha movido.' : `Colocada. ${describeTarget(String(over.id))}`,
  onDragCancel: () => 'Arrastre cancelado.',
}

function describeTarget(id: string): string {
  const target = parseDropTargetId(id)
  if (target === null) return 'Zona no válida.'
  if (target.kind === 'unplaced') return 'Sin colocar.'
  return `${weekdayLongEs(target.day)} a las ${blockLabel(target.block)}.`
}

/*
 * Planificador semanal, independiente de los hábitos (CLAUDE.md §4 y §5.4).
 * Dos piezas y nada más: la caja donde se escribe y la cuadrícula donde se
 * coloca. No hay listas por día — arrastrar es lo que decide día y hora.
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
      accessibility={{ announcements }}
      collisionDetection={collisionDetection}
      // Las 252 celdas de escritorio no se miden hasta que empieza un arrastre.
      measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="mx-auto max-w-xl px-5 py-6 md:max-w-6xl md:px-10 md:py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-3">
          <h1 className="font-display text-2xl uppercase tracking-widest text-ink">Planificador</h1>
          {pendingTotal > 0 && (
            <span className="font-display text-xs uppercase tracking-widest text-streak-orange">
              {pendingTotal} {pendingTotal === 1 ? 'pendiente' : 'pendientes'}
            </span>
          )}
        </div>

        <WeekNavigator weekId={weekId} currentWeekId={currentWeekId} onChange={setWeekId} />

        {/* El editor vive aquí, a ancho completo: en escritorio una columna de
            día es un séptimo de la pantalla y el formulario no cabría dentro. */}
        {editing !== undefined && (
          <div className="mt-4">
            <TaskEditor key={editing.id} task={editing} onClose={closeEdit} />
          </div>
        )}

        <UnplacedTray weekId={weekId} tasks={unplaced} editingId={editingId} onEdit={setEditingId} />

        {!isDesktop && (
          <MobileDayPager
            selected={selectedDay}
            today={todayWeekday}
            pendingByDay={pendingByDay}
            onSelect={setSelectedDay}
          />
        )}

        <HourGrid
          days={visibleDays}
          dates={days}
          tasksByDay={byDay}
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

        {/* Imprescindible: la caja y la cuadrícula son contenedores distintos,
            y sin capa flotante no se puede arrastrar de una a otra. */}
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
