import { useState } from 'react'
import { Link } from 'react-router'
import { FixedTaskForm } from '../components/planner/FixedTaskForm'
import {
  createFixedTask,
  deleteFixedTask,
  updateFixedTask,
} from '../data/repositories/taskTemplatesRepo'
import { useFixedTasks } from '../hooks/usePlanner'
import { weekdayShortEs } from '../logic/dates'
import { blockLabel, durationLabel, type FixedTask } from '../logic/planner'

/*
 * Catálogo de tareas fijas (CLAUDE.md §4). Una ficha, varios días, y la hora de
 * cada día por separado: un jueves no es un sábado. Cada semana nueva genera
 * sus tareas a partir de aquí; editar o borrar la tarea de una semana concreta
 * no toca la ficha, y editar la ficha solo afecta a las semanas aún sin abrir.
 */
export function FixedTasks() {
  const fixedTasks = useFixedTasks()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-xl px-5 py-6 md:px-8 md:py-10">
      <Link
        to="/planificador"
        className="inline-flex h-11 items-center font-display text-xs uppercase tracking-widest text-ink-soft transition-colors hover:text-streak-lime"
      >
        ← Planificador
      </Link>

      <div className="mt-2 flex items-baseline justify-between gap-3 border-b border-line pb-3">
        <h1 className="font-display text-2xl uppercase tracking-widest text-ink">Tareas fijas</h1>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setCreating(true)
            }}
            className="h-11 shrink-0 rounded-sm bg-ink px-4 font-display text-xs uppercase tracking-widest text-paper"
          >
            Nueva
          </button>
        )}
      </div>

      <p className="mt-3 text-sm text-ink-soft">
        Lo que se repite cada semana. Se crean solas al abrir una semana nueva, cada una en sus días
        y a su hora. Lo que escribas suelto en un día del planificador no vive aquí: eso desaparece
        al cambiar de semana.
      </p>

      {creating && (
        <div className="mt-4">
          <FixedTaskForm
            onSubmit={(values) => {
              void createFixedTask(values)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {fixedTasks !== undefined && fixedTasks.length === 0 && !creating && (
        <p className="mt-6 text-sm text-ink-faint">
          Sin tareas fijas todavía. «Nueva» para crear la primera.
        </p>
      )}

      {fixedTasks !== undefined && fixedTasks.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {fixedTasks.map((fixed) => (
            <li key={fixed.groupId} className="py-2">
              {editingId === fixed.groupId ? (
                <FixedTaskForm
                  initial={fixed}
                  onSubmit={(values) => {
                    void updateFixedTask(fixed.groupId, values)
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex min-h-14 items-center gap-1">
                  <div className="min-w-0 flex-1 border-l-2 border-l-streak-lime pl-3">
                    <p className="truncate text-base text-ink">{fixed.text}</p>
                    <p className="mt-0.5 font-display text-xs text-ink-soft">{daysLabel(fixed)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false)
                      setEditingId(fixed.groupId)
                    }}
                    className="h-11 shrink-0 rounded-sm px-2 font-display text-xs uppercase tracking-widest text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                  >
                    Editar
                  </button>
                  <DeleteFixedTaskButton groupId={fixed.groupId} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Confirmación en línea de dos pasos, como en la copia de seguridad. */
function DeleteFixedTaskButton({ groupId }: { groupId: string }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-11 shrink-0 rounded-sm px-2 font-display text-xs uppercase tracking-widest text-ink-soft transition-colors hover:bg-surface hover:text-ink"
      >
        Eliminar
      </button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => void deleteFixedTask(groupId)}
        className="h-11 rounded-sm border border-streak-red px-2 font-display text-xs uppercase text-streak-red transition-colors hover:bg-surface"
      >
        Seguro
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-11 rounded-sm px-2 font-display text-xs uppercase text-ink-soft transition-colors hover:bg-surface hover:text-ink"
      >
        No
      </button>
    </div>
  )
}

/** 'JUE 19:00 · SÁB 11:00 (1 h) · DOM sin hora'. */
function daysLabel(fixed: FixedTask): string {
  return fixed.days
    .map((day) => {
      const parts = [weekdayShortEs(day.weekday).toUpperCase()]
      parts.push(day.startBlock === null ? 'sin hora' : blockLabel(day.startBlock))
      const duration = durationLabel(day.estimatedMinutes)
      if (duration !== null) parts.push(`(${duration})`)
      return parts.join(' ')
    })
    .join(' · ')
}
