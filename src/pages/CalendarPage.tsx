import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { sk } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { rangeStats, type DayStats } from '@/db/days'
import { parseISODate, toISODate } from '@/domain/dates'
import { WEEKDAY_SHORT } from '@/domain/describe'
import type { Weekday } from '@/domain/types'
import { useToday } from '@/hooks/useToday'

export function CalendarPage() {
  const today = useToday()
  const [month, setMonth] = useState(() => startOfMonth(parseISODate(today)))
  const gridStart = startOfWeek(month, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const from = toISODate(gridStart)
  const to = toISODate(gridEnd)
  const stats = useLiveQuery(() => rangeStats(from, to), [from, to])

  return (
    <section className="pt-4">
      <header className="flex items-center gap-2">
        <button aria-label="Predchádzajúci mesiac" className="p-2 text-3xl font-bold text-accent2" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <h1 className="heading flex-1 text-center font-sans text-xl font-bold first-letter:uppercase">
          {format(month, 'LLLL yyyy', { locale: sk })}
        </h1>
        <button aria-label="Nasledujúci mesiac" className="p-2 text-3xl font-bold text-accent2" onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </header>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => (
          <div key={d} className="pb-1 text-xs font-bold tracking-wider text-accent2 uppercase">
            {WEEKDAY_SHORT[d]}
          </div>
        ))}
        {days.map((day) => {
          const iso = toISODate(day)
          const inMonth = day.getMonth() === month.getMonth()
          return (
            <Link
              key={iso}
              to={iso === today ? '/' : `/den/${iso}`}
              className={`shape-sm flex aspect-square flex-col items-center justify-center border text-sm ${
                inMonth ? '' : 'opacity-30'
              } ${dayColor(stats?.get(iso), iso <= today)} ${iso === today ? 'outline-2 outline-offset-1 outline-accent2' : ''}`}
            >
              <span className="font-semibold">{day.getDate()}</span>
              {iso <= today && stats?.get(iso)?.total ? (
                <span className="text-[10px] leading-none">{percent(stats.get(iso)!)} %</span>
              ) : null}
            </Link>
          )
        })}
      </div>

      <div className="mt-4 flex justify-center gap-4 text-xs text-muted">
        <Legend className="border-line bg-accent">100 %</Legend>
        <Legend className="border-line bg-surface-hi border-b-2 border-b-accent">čiastočne</Legend>
        <Legend className="border-line/50 bg-danger/15">nič</Legend>
      </div>
    </section>
  )
}

const percent = (s: DayStats) => Math.round((s.done / s.total) * 100)

function dayColor(stats: DayStats | undefined, pastOrToday: boolean): string {
  if (!pastOrToday || !stats?.total) return 'border-line/30 bg-surface/60 text-muted'
  if (stats.done === stats.total) return 'border-line bg-accent text-surface'
  if (stats.done > 0) return 'border-line bg-surface-hi text-ink border-b-4 border-b-accent'
  return 'border-line/50 bg-danger/15 text-danger'
}

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-3 border ${className}`} />
      {children}
    </span>
  )
}
