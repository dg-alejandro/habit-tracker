import { useState, type FormEvent } from 'react'
import { createFrozenRange, deleteFrozenRange } from '../../data/repositories/frozenRepo'
import { useFrozenRanges } from '../../hooks/useFrozenRanges'
import { formatDateShortEs } from '../../logic/dates'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRows } from '../ui/Skeleton'
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET, FIELD_CLASS } from '../ui/classes'
import type { FrozenRange } from '../../data/types'

/**
 * Gestión de rangos de días congelados: por adelantado (vacaciones) o
 * retroactivos (enfermedad). Un día congelado ni suma ni rompe.
 */
export function FrozenRangesSection() {
  const ranges = useFrozenRanges()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')

  const invalidRange = startDate !== '' && endDate !== '' && endDate < startDate
  const canSubmit = startDate !== '' && endDate !== '' && !invalidRange

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    void createFrozenRange(startDate, endDate, note)
    setStartDate('')
    setEndDate('')
    setNote('')
  }

  return (
    <section className="mt-12">
      <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">Días congelados</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Un día congelado ni suma ni rompe: se salta en las rachas y se excluye de los porcentajes.
      </p>

      <form onSubmit={submit} className="mt-3 rounded-sm border border-line p-4">
        <div className="flex flex-wrap gap-3">
          <label className="block min-w-36 flex-1">
            <span className="font-display text-xs uppercase tracking-widest text-ink-soft">Desde</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.currentTarget.value)}
              className={`mt-1 w-full ${FIELD_CLASS} font-display tabular-nums`}
            />
          </label>
          <label className="block min-w-36 flex-1">
            <span className="font-display text-xs uppercase tracking-widest text-ink-soft">Hasta</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.currentTarget.value)}
              className={`mt-1 w-full ${FIELD_CLASS} font-display tabular-nums`}
            />
          </label>
        </div>
        {/* Era el único campo de toda la app sin nombre accesible: solo tenía
            placeholder, que desaparece en cuanto escribes. */}
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
          aria-label="Nota del rango congelado"
          placeholder="Nota (opcional: vacaciones, enfermedad…)"
          className={`mt-3 w-full ${FIELD_CLASS}`}
        />
        {invalidRange && (
          <p role="alert" className="mt-2 text-sm font-semibold text-ink">
            El final no puede ser anterior al inicio.
          </p>
        )}
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={!canSubmit} className={BUTTON_PRIMARY}>
            Congelar rango
          </button>
        </div>
      </form>

      {/* Tres ramas y no dos: antes `undefined` y `[]` caían en la misma
          condición y las dos pintaban silencio, así que no había forma de
          distinguir «cargando» de «no hay ningún rango». */}
      {ranges === undefined ? (
        <SkeletonRows rows={2} className="mt-3" />
      ) : ranges.length === 0 ? (
        <EmptyState className="mt-3">Ningún rango congelado.</EmptyState>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {ranges.map((range) => (
            <li key={range.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-display text-sm text-ink">{formatRange(range)}</p>
                {range.note !== undefined && <p className="truncate text-xs text-ink-soft">{range.note}</p>}
              </div>
              <DeleteRangeButton range={range} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Borrar un rango es un borrado de verdad: destruye el registro y recalcula
 * rachas y porcentajes HACIA ATRÁS. Era el último borrado de un solo paso que
 * quedaba en la app, y encima en gris. Ahora es rojo y en dos pasos, como el
 * resto (§6).
 */
function DeleteRangeButton({ range }: { range: FrozenRange }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Eliminar el rango ${formatRange(range)}`}
        className={`shrink-0 ${BUTTON_QUIET} text-streak-red hover:text-streak-red`}
      >
        Eliminar
      </button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => void deleteFrozenRange(range.id)}
        className={BUTTON_DANGER}
      >
        Eliminar de verdad
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={BUTTON_QUIET}>
        No
      </button>
    </div>
  )
}

function formatRange(range: FrozenRange): string {
  if (range.startDate === range.endDate) return formatDateShortEs(range.startDate)
  return `${formatDateShortEs(range.startDate)} — ${formatDateShortEs(range.endDate)}`
}
