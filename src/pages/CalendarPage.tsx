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
        <button aria-label="Predchádzajúci mesiac" className="p-2 text-2xl" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <h1 className="flex-1 text-center text-xl font-bold first-letter:uppercase">
          {format(month, 'LLLL yyyy', { locale: sk })}
        </h1>
        <button aria-label="Nasledujúci mesiac" className="p-2 text-2xl" onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </header>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => (
          <div key={d} className="pb-1 text-xs font-medium text-slate-500">
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
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm ${
                inMonth ? '' : 'opacity-30'
              } ${dayColor(stats?.get(iso), iso <= today)} ${iso === today ? 'ring-2 ring-blue-500' : ''}`}
            >
              <span className="font-medium">{day.getDate()}</span>
              {iso <= today && stats?.get(iso)?.total ? (
                <span className="text-[10px] leading-none">{percent(stats.get(iso)!)} %</span>
              ) : null}
            </Link>
          )
        })}
      </div>

      <div className="mt-4 flex justify-center gap-4 text-xs text-slate-500">
        <Legend className="bg-green-500/80">100 %</Legend>
        <Legend className="bg-amber-300/80 dark:bg-amber-500/60">čiastočne</Legend>
        <Legend className="bg-red-200 dark:bg-red-900/70">nič</Legend>
      </div>
    </section>
  )
}

const percent = (s: DayStats) => Math.round((s.done / s.total) * 100)

function dayColor(stats: DayStats | undefined, pastOrToday: boolean): string {
  if (!pastOrToday || !stats?.total) return 'bg-slate-50 dark:bg-slate-900'
  if (stats.done === stats.total) return 'bg-green-500/80 text-white'
  if (stats.done > 0) return 'bg-amber-300/80 dark:bg-amber-500/60'
  return 'bg-red-200 dark:bg-red-900/70'
}

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-3 rounded ${className}`} />
      {children}
    </span>
  )
}
