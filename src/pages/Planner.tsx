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
import { TaskBank } from '../components/planner/TaskBank'
import { TaskEditor } from '../components/planner/TaskEditor'
import { UnplacedTray } from '../components/planner/UnplacedTray'
import { WeekNavigator } from '../components/planner/WeekNavigator'
import { createTaskFromBank, moveTask } from '../data/repositories/plannerTasksRepo'
import {
  useBankTasks,
  useIsDesktop,
  useNowMarker,
  useWeekPreparation,
  useWeekTasks,
} from '../hooks/usePlanner'
import { useLogicalToday } from '../hooks/useLogicalToday'
import { EmptyState } from '../components/ui/EmptyState'
import { PageTitle } from '../components/ui/PageTitle'
import {
  addWeeksToWeekId,
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
  parseBankDragId,
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
 * 42 px: se prioriza lo que hay bajo el puntero y solo se cae al solape de
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
  onDragStart: () => 'Agarrada. Suéltala en un hueco de la cuadrícula.',
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
 * Tres piezas: el banco de tareas reutilizables, la caja de sueltas de esta
 * semana y la cuadrícula. No hay listas por día — arrastrar decide día y hora.
 */
export function Planner() {
  const today = useLogicalToday()
  const currentWeekId = isoWeekIdOf(today)
  // El domingo se abre ya en la semana que EMPIEZA (§1: «los domingos organizo
  // la semana que empieza»). Si no, planificar un domingo por la noche caería
  // sobre la semana que muere, y la purga del lunes se lo llevaría todo.
  const planningAhead = isoWeekdayOf(today) === 7

  const desiredWeekId = planningAhead ? addWeeksToWeekId(currentWeekId, 1) : currentWeekId
  const desiredDay: IsoWeekday = planningAhead ? 1 : isoWeekdayOf(today)

  /*
   * La semana y el día visibles se RE-BASAN cuando cambia el día lógico.
   *
   * Antes eran dos `useState` con inicializador perezoso, y React solo ejecuta
   * ese inicializador al montar: al cruzar las 4:00 con la pestaña abierta,
   * `currentWeekId` avanzaba y `weekId` no. Consecuencias, todas reales: se
   * apagaba la columna de hoy, desaparecía la raya magenta de la hora actual
   * (useNowMarker exige todayWeekday) y `ensureWeekReady` salía por su primera
   * línea, o sea que la purga semanal dejaba de correr mientras no se recargara.
   *
   * Se guarda la base junto al valor elegido y se ajusta en render —el patrón
   * de «estado derivado que se corrige»—, no en un efecto: así no hay un
   * fotograma pintado con el valor viejo. Cruzar las 4:00 descarta la
   * navegación manual, y es lo correcto: ocurre mientras el propietario duerme.
   */
  const [view, setView] = useState({ base: today, weekId: desiredWeekId, day: desiredDay })
  if (view.base !== today) {
    setView({ base: today, weekId: desiredWeekId, day: desiredDay })
  }
  const weekId = view.weekId
  const selectedDay = view.day
  const setWeekId = (next: WeekId) => setView((current) => ({ ...current, weekId: next }))
  const setSelectedDay = (next: IsoWeekday) => setView((current) => ({ ...current, day: next }))

  const [editingId, setEditingId] = useState<string | null>(null)
  // La madrugada arranca plegada (§4): 48 bloques enteros son ingobernables.
  const [nightOpen, setNightOpen] = useState(false)
  const isDesktop = useIsDesktop()

  const [dragging, setDragging] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)

  const settled = useWeekPreparation(weekId, currentWeekId)
  const liveTasks = useWeekTasks(weekId)
  const bank = useBankTasks()

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
  const now = useNowMarker(todayWeekday)

  const editing = (tasks ?? []).find((task) => task.id === editingId)
  const draggingBankId = dragging === null ? null : parseBankDragId(dragging)
  const draggingBank = (bank ?? []).find((item) => item.id === draggingBankId)
  const draggingTask = (tasks ?? []).find((task) => task.id === dragging)
  // `undefined` mientras Dexie responde, y NO aplastado a []: la caja de sueltas
  // anunciaba «nada suelto» y el banco un «· 0» antes de saber si había algo.
  const unplaced = useMemo(
    () => (tasks === undefined ? undefined : unplacedTasks(tasks)),
    [tasks],
  )
  const byDay = useMemo(() => groupTasksByDay(tasks ?? []), [tasks])
  const pendingByDay = useMemo(
    () => (tasks === undefined ? undefined : countPendingByDay(byDay)),
    [tasks, byDay],
  )

  const closeEdit = () => setEditingId(null)

  const onDragStart = (event: DragStartEvent) => setDragging(String(event.active.id))

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null)
    const { active, over } = event
    if (over === null) return
    const target = parseDropTargetId(String(over.id))
    if (target === null) return
    const dragId = String(active.id)
    const { day, startBlock } = placementFor(target)

    // Del banco sale una tarea NUEVA; la ficha se queda para volver a usarla.
    const bankId = parseBankDragId(dragId)
    if (bankId !== null) {
      const item = (bank ?? []).find((row) => row.id === bankId)
      if (item !== undefined) void createTaskFromBank(item, weekId, day, startBlock)
      if (!isDesktop && day !== null) setSelectedDay(day)
      return
    }

    setPendingMove({ id: dragId, day, startBlock })
    void moveTask(dragId, day, startBlock)
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
      {/* Sin tope de ancho en escritorio, al contrario que el resto de la app:
          siete columnas dentro de `max-w-6xl` dejaban 140 px por día y el nombre
          de la tarea salía recortado. Es un calendario — se queda con la pantalla. */}
      <div className="mx-auto max-w-xl px-5 py-6 md:max-w-none md:px-8 md:py-10">
        <PageTitle>Planificador</PageTitle>

        <WeekNavigator weekId={weekId} currentWeekId={currentWeekId} onChange={setWeekId} />

        {/* La preparación de la semana (generar y purgar) espera a una bajada
            completa cuando hay sesión — es el arreglo de pérdida de datos del
            28/07 y no se relaja. Lo que faltaba era contarlo: sin red, esto se
            quedaba parado en silencio y nadie sabía por qué. */}
        {!settled && (
          <EmptyState className="mt-3" role="status">
            Esperando a sincronizar: la limpieza de la semana está en pausa.
          </EmptyState>
        )}

        {/* El editor vive aquí, a ancho completo: en escritorio una columna de
            día es un séptimo de la pantalla y el formulario no cabría dentro. */}
        {editing !== undefined && (
          <div className="mt-4">
            <TaskEditor key={editing.id} task={editing} onClose={closeEdit} />
          </div>
        )}

        {/* Del banco a la caja de sin colocar, sin gesto: desde ahí el editor
            le pone día y hora. Es la alternativa sin arrastre que pide §4. */}
        <TaskBank
          bank={bank}
          onSend={(item) => void createTaskFromBank(item, weekId, null, null)}
        />

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
          now={now}
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
          {draggingBank !== undefined ? (
            <div className="rounded-sm border border-streak-lime bg-surface px-3 py-2 text-base text-ink opacity-90">
              {draggingBank.text}
            </div>
          ) : draggingTask === undefined ? null : (
            /* El borde sigue el ORIGEN de la tarea (§4: lima si vino del banco,
               naranja si es suelta). Estaba fijo en lima, así que al arrastrar
               una suelta el chip se contradecía consigo mismo: borde exterior
               lima y filete interior naranja. */
            <div
              className={`w-64 rounded-sm border bg-surface px-2 opacity-90 ${
                draggingTask.templateId === null ? 'border-streak-orange' : 'border-streak-lime'
              }`}
            >
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
