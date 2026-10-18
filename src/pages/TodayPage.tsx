import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { buttonPrimary, input } from '@/components/ui'
import { addQuickTask, dayStats, getDayView, materializeDay, moveOccurrence, setStatus, type DayItem } from '@/db/days'
import { addDaysISO, formatDayTitle, formatShortDate } from '@/domain/dates'
import type { ISODate } from '@/domain/types'
import { useToday } from '@/hooks/useToday'

export function TodayPage() {
  const today = useToday()
  const { date = today } = useParams()
  const navigate = useNavigate()
  const items = useLiveQuery(() => getDayView(date, today), [date, today])
  const isFuture = date > today

  useEffect(() => {
    if (date === today) void materializeDay(today)
  }, [date, today])

  const goTo = (target: ISODate) => navigate(target === today ? '/' : `/den/${target}`)
  const stats = dayStats(items ?? [])
  const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0

  return (
    <section className="pt-4">
      <header className="flex items-center gap-2">
        <button aria-label="Predchádzajúci deň" className="p-2 text-2xl" onClick={() => goTo(addDaysISO(date, -1))}>
          ‹
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold first-letter:uppercase">{formatDayTitle(date)}</h1>
          {date !== today && (
            <Link to="/" className="text-sm text-blue-600 dark:text-blue-400">
              Späť na dnes
            </Link>
          )}
        </div>
        <button aria-label="Nasledujúci deň" className="p-2 text-2xl" onClick={() => goTo(addDaysISO(date, 1))}>
          ›
        </button>
      </header>

      {stats.total > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm text-slate-500">
            <span>
              Hotovo {stats.done}/{stats.total}
            </span>
            <span>{percent} %</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {isFuture && <p className="mt-4 text-sm text-slate-500">Náhľad naplánovaných úloh – odškrtnúť ich pôjde v daný deň.</p>}

      <ul className="mt-4 space-y-2">
        {items?.map((item) => (
          <TaskRow key={item.key} item={item} date={date} readOnly={isFuture || !item.occurrence} />
        ))}
      </ul>

      {items?.length === 0 && <p className="mt-6 text-slate-500">Na tento deň nie sú žiadne úlohy.</p>}

      <QuickAdd date={date} today={today} />
    </section>
  )
}

function TaskRow({ item, date, readOnly }: { item: DayItem; date: ISODate; readOnly: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const occurrence = item.occurrence
  const done = item.status === 'done'
  const inactive = item.status === 'skipped' || item.status === 'carried'

  const toggle = () => {
    if (occurrence && !inactive) void setStatus(occurrence.id, done ? 'open' : 'done')
  }

  return (
    <li className="rounded-2xl bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center gap-3 p-3">
        <button
          aria-label={done ? 'Označiť ako nehotové' : 'Označiť ako hotové'}
          disabled={readOnly || inactive}
          onClick={toggle}
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
            done ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300 dark:border-slate-600'
          } disabled:opacity-40`}
        >
          {done && '✓'}
        </button>
        <div className={`min-w-0 flex-1 ${done || inactive ? 'text-slate-400 line-through' : ''}`}>
          <div className="truncate font-medium">
            {item.priority === 'high' && <span className="mr-1 text-red-500">!</span>}
            {item.title}
          </div>
          <div className="text-xs text-slate-500 no-underline">
            {[
              item.timeOfDay,
              item.carriedFrom && `prenesená z ${formatShortDate(item.carriedFrom)}`,
              item.status === 'skipped' && 'preskočená',
              item.status === 'carried' && 'presunutá',
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        {!readOnly && (
          <button aria-label="Ďalšie akcie" className="px-2 text-xl text-slate-400" onClick={() => setMenuOpen(!menuOpen)}>
            ⋯
          </button>
        )}
      </div>
      {menuOpen && occurrence && (
        <div className="flex flex-wrap gap-2 px-3 pb-3 text-sm">
          {item.status === 'skipped' ? (
            <MenuButton onClick={() => setStatus(occurrence.id, 'open')}>Obnoviť</MenuButton>
          ) : (
            item.status === 'open' && (
              <>
                <MenuButton onClick={() => setStatus(occurrence.id, 'skipped')}>Preskočiť</MenuButton>
                <MenuButton onClick={() => moveOccurrence(occurrence, addDaysISO(date, 1))}>Presunúť na zajtra</MenuButton>
              </>
            )
          )}
          {item.activity && (
            <Link to={`/aktivity/${item.activity.id}`} className="rounded-lg bg-white px-3 py-1.5 dark:bg-slate-800">
              Upraviť aktivitu
            </Link>
          )}
        </div>
      )}
    </li>
  )
}

function MenuButton({ onClick, children }: { onClick: () => Promise<void>; children: string }) {
  return (
    <button className="rounded-lg bg-white px-3 py-1.5 dark:bg-slate-800" onClick={() => void onClick()}>
      {children}
    </button>
  )
}

function QuickAdd({ date, today }: { date: ISODate; today: ISODate }) {
  const [title, setTitle] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = title.trim()
    if (!value) return
    await addQuickTask(value, date, today)
    setTitle('')
  }

  return (
    <form onSubmit={submit} className="mt-6 flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Pridať úlohu na tento deň"
        className={input}
        enterKeyHint="done"
      />
      <button type="submit" className={buttonPrimary} disabled={!title.trim()}>
        +
      </button>
    </form>
  )
}
