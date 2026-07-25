import { useState } from 'react'
import { Link } from 'react-router'
import { TemplateForm, type TemplateFormValues } from '../components/planner/TemplateForm'
import {
  createTaskTemplate,
  deleteTaskTemplate,
  updateTaskTemplate,
} from '../data/repositories/taskTemplatesRepo'
import { useTaskTemplates } from '../hooks/usePlanner'
import { weekdayLongEs } from '../logic/dates'
import { blockLabel, durationLabel } from '../logic/planner'
import type { IsoWeekday, TaskTemplate } from '../data/types'

/*
 * Catálogo de tareas fijas (CLAUDE.md §4). Cada plantilla genera su tarea al
 * abrir una semana nueva; editar o borrar la tarea de una semana concreta NO
 * toca la plantilla, y editar la plantilla solo afecta a las semanas futuras.
 */
export function TaskTemplates() {
  const templates = useTaskTemplates()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const submitCreate = (values: TemplateFormValues) => {
    void createTaskTemplate(values)
    setCreating(false)
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-6 md:px-10 md:py-10">
      <Link
        to="/planificador"
        className="inline-flex h-11 items-center text-sm text-ink-soft transition-colors hover:text-ink"
      >
        ← Planificador
      </Link>

      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Tareas fijas</h1>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-11 shrink-0 rounded-lg bg-ink px-4 text-sm font-semibold text-paper"
          >
            Nueva
          </button>
        )}
      </div>

      <p className="mt-2 text-sm text-ink-soft">
        Se crean solas al abrir una semana nueva. Editar o borrar la tarea de una semana concreta no
        toca la plantilla; editar la plantilla solo afecta a las semanas que aún no se han abierto.
      </p>

      {creating && (
        <div className="mt-4">
          <TemplateForm onSubmit={submitCreate} onCancel={() => setCreating(false)} />
        </div>
      )}

      {templates !== undefined && templates.length === 0 && !creating && (
        <p className="mt-6 text-sm text-ink-soft">Sin tareas fijas todavía.</p>
      )}

      {templates !== undefined && templates.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {templates.map((template, index) => (
            <li key={template.id}>
              {isFirstOfDay(templates, index) && (
                <h2 className="mt-4 text-xs font-medium uppercase tracking-widest text-ink-soft first:mt-0">
                  {weekdayLongEs(template.weekday)}
                </h2>
              )}
              {editingId === template.id ? (
                <div className="py-3">
                  <TemplateForm
                    initial={template}
                    onSubmit={(values) => {
                      void updateTaskTemplate(template.id, {
                        ...values,
                        estimatedMinutes: values.estimatedMinutes ?? null,
                      })
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="flex min-h-14 items-center gap-1 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base text-ink">{template.text}</p>
                    <p className="text-xs text-ink-soft">{templateMeta(template)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(template.id)}
                    className="h-11 shrink-0 rounded-lg px-2 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                  >
                    Editar
                  </button>
                  <DeleteTemplateButton id={template.id} />
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
function DeleteTemplateButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-11 shrink-0 rounded-lg px-2 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
      >
        Eliminar
      </button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => void deleteTaskTemplate(id)}
        className="h-11 rounded-lg border border-line px-2 text-sm font-semibold text-ink transition-colors hover:bg-surface"
      >
        Seguro
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-11 rounded-lg px-2 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
      >
        No
      </button>
    </div>
  )
}

function isFirstOfDay(templates: readonly TaskTemplate[], index: number): boolean {
  const previous = templates[index - 1]
  const current = templates[index]
  if (current === undefined) return false
  return previous === undefined || previous.weekday !== current.weekday
}

function templateMeta(template: TaskTemplate): string {
  const parts: string[] = [capitalize(weekdayLongEs(template.weekday as IsoWeekday))]
  if (template.startBlock !== null) parts.push(blockLabel(template.startBlock))
  const duration = durationLabel(template.estimatedMinutes)
  if (duration !== null) parts.push(duration)
  return parts.join(' · ')
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
