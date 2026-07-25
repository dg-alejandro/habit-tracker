import { useMemo, useState } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import {
  computeMonthlySeries,
  computeWeeklySeries,
  computeYearlySeries,
  type PeriodPoint,
  type SeriesInput,
} from '../../logic/stats'

type Granularity = 'week' | 'month' | 'year'

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'week', label: 'Semanas' },
  { key: 'month', label: 'Meses' },
  { key: 'year', label: 'Años' },
]

interface EvolutionChartProps {
  input: SeriesInput
}

/* Evolución del % de cumplimiento por semana, mes o año (CLAUDE.md §5.3). */
export function EvolutionChart({ input }: EvolutionChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('week')
  const points: PeriodPoint[] = useMemo(() => {
    if (granularity === 'week') return computeWeeklySeries(input)
    if (granularity === 'month') return computeMonthlySeries(input)
    return computeYearlySeries(input)
  }, [granularity, input])

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">Evolución</h2>
        <div className="flex gap-1" role="group" aria-label="Granularidad de la gráfica">
          {GRANULARITIES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={granularity === key}
              onClick={() => setGranularity(key)}
              className={`h-11 rounded-sm px-3 text-sm ${
                granularity === key
                  ? 'bg-surface font-semibold text-ink'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 16, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={granularity === 'week' ? 1 : 0}
              tick={{ fill: 'var(--color-ink-soft)', fontSize: 11 }}
            />
            <YAxis domain={[0, 100]} hide />
            <Bar
              dataKey="percentage"
              fill="var(--color-streak-orange)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="percentage"
                position="top"
                fill="var(--color-ink-soft)"
                fontSize={10}
                formatter={(value: unknown) => (typeof value === 'number' ? String(value) : '')}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-ink-faint">% de cumplimiento por periodo</p>
    </section>
  )
}
