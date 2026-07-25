import { useState } from 'react'
import { duplicatePreviousWeek } from '../../data/repositories/plannerTasksRepo'
import { addWeeksToWeekId, formatWeekRangeEs, type WeekId } from '../../logic/dates'

interface DuplicateWeekButtonProps {
  weekId: WeekId
}

/**
 * Duplicar la semana anterior (§4): copia sus tareas sin el estado de
 * completado. Confirmación en línea de dos pasos, como la copia de seguridad:
 * es una acción que puede meter veinte filas de golpe.
 */
export function DuplicateWeekButton({ weekId }: DuplicateWeekButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    setBusy(true)
    try {
      const copied = await duplicatePreviousWeek(weekId)
      setConfirming(false)
      setMessage(
        copied === 0
          ? 'La semana anterior no tenía nada que copiar.'
          : `Copiadas ${copied} tareas, sin marcar.`,
      )
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            setMessage(null)
            setConfirming(true)
          }}
          className="inline-flex h-11 items-center text-sm text-ink-faint underline-offset-2 transition-colors hover:text-ink-soft hover:underline"
        >
          Duplicar la semana anterior
        </button>
        {message !== null && <p className="text-sm text-ink-soft">{message}</p>}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-sm text-ink">
        Se copiarán aquí las tareas del {formatWeekRangeEs(addWeeksToWeekId(weekId, -1))}, sin su
        estado de completado. Las tareas fijas no se copian: esta semana genera las suyas.
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void run()
          }}
          className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-30"
        >
          Duplicar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(false)}
          className="h-11 rounded-lg px-4 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
