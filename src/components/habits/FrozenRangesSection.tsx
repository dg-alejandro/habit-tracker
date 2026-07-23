import { useState, type FormEvent } from 'react'
import { createFrozenRange, deleteFrozenRange } from '../../data/repositories/frozenRepo'
import { useFrozenRanges } from '../../hooks/useFrozenRanges'
import { formatDateShortEs } from '../../logic/dates'
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
      <h2 className="text-xs font-medium uppercase tracking-widest text-ink-soft">Días congelados</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Un día congelado ni suma ni rompe: se salta en las rachas y se excluye de los porcentajes.
      </p>

      <form onSubmit={submit} className="mt-3 rounded-lg border border-line p-4">
        <div className="flex flex-wrap gap-3">
          <label className="block min-w-36 flex-1">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Desde</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.currentTarget.value)}
              className="mt-1 h-11 w-full rounded-lg border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
          <label className="block min-w-36 flex-1">
            <span className="text-xs font-medium uppercase tracking-widest text-ink-soft">Hasta</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.currentTarget.value)}
              className="mt-1 h-11 w-full rounded-lg border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
        </div>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
          placeholder="Nota (opcional: vacaciones, enfermedad…)"
          className="mt-3 h-11 w-full rounded-lg border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint"
        />
        {invalidRange && (
          <p className="mt-2 text-sm font-semibold text-ink">El final no puede ser anterior al inicio.</p>
        )}
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-paper transition-opacity disabled:opacity-30"
          >
            Congelar rango
          </button>
        </div>
      </form>

      {ranges !== undefined && ranges.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {ranges.map((range) => (
            <li key={range.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-ink">{formatRange(range)}</p>
                {range.note !== undefined && <p className="truncate text-xs text-ink-soft">{range.note}</p>}
              </div>
              <button
                type="button"
                onClick={() => void deleteFrozenRange(range.id)}
                className="h-11 shrink-0 rounded-lg px-2 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatRange(range: FrozenRange): string {
  if (range.startDate === range.endDate) return formatDateShortEs(range.startDate)
  return `${formatDateShortEs(range.startDate)} — ${formatDateShortEs(range.endDate)}`
}
