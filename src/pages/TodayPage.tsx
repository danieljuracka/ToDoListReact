import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { RankBadge, Shuriken } from '@/components/Ninja'
import { buttonPrimary, buttonSmall, input } from '@/components/ui'
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
        <button aria-label="Predchádzajúci deň" className="p-2 text-3xl font-bold text-accent2" onClick={() => goTo(addDaysISO(date, -1))}>
          ‹
        </button>
        <div className="flex-1 text-center">
          <h1 className="heading font-sans text-xl font-bold first-letter:uppercase">{formatDayTitle(date)}</h1>
          {date !== today && (
            <Link to="/" className="text-sm text-accent">
              Späť na dnes
            </Link>
          )}
        </div>
        <button aria-label="Nasledujúci deň" className="p-2 text-3xl font-bold text-accent2" onClick={() => goTo(addDaysISO(date, 1))}>
          ›
        </button>
      </header>

      {stats.total > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs font-bold tracking-wider text-accent2 uppercase">
            <span>
              Splnené misie {stats.done}/{stats.total}
            </span>
            <span>{percent === 100 ? "Misia splnená!" : `${percent} %`}</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full border-2 border-line bg-surface-hi shadow-ink">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-all duration-500"
              style={{
                width: `${percent}%`,
                // diagonálne pruhy ako prúdiaca chakra
                backgroundImage:
                  'repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.25) 0 6px, transparent 6px 12px), linear-gradient(to right, var(--color-accent), var(--color-accent2))',
              }}
            />
          </div>
        </div>
      )}

      {isFuture && <p className="mt-4 text-sm text-muted">Náhľad naplánovaných misií – splniť ich pôjde v daný deň.</p>}

      <ul className="mt-4 space-y-2">
        {items?.map((item) => (
          <TaskRow key={item.key} item={item} date={date} readOnly={isFuture || !item.occurrence} />
        ))}
      </ul>

      {items?.length === 0 && <p className="mt-6 text-muted">Na tento deň nie sú žiadne misie.</p>}

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
    <li className={`panel transition-colors ${done ? "border-l-accent3" : ""}`}>
      <div className="flex items-center gap-3 p-3">
        <button
          aria-label={done ? 'Označiť ako nehotové' : 'Označiť ako hotové'}
          disabled={readOnly || inactive}
          onClick={toggle}
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
            done ? 'text-line' : 'border-2 border-dashed border-line/60'
          } disabled:opacity-30`}
        >
          {done && <Shuriken className="animate-check size-8" />}
        </button>
        <div className={`min-w-0 flex-1 ${done || inactive ? 'text-muted line-through' : ''}`}>
          <div className="font-bold">
            <span className="flex items-center gap-2">
              <RankBadge priority={item.priority} />
              <span className="truncate">{item.title}</span>
            </span>
          </div>
          <div className="text-xs text-muted no-underline">
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
          <button aria-label="Ďalšie akcie" className="px-2 text-xl text-muted active:text-accent" onClick={() => setMenuOpen(!menuOpen)}>
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
            <Link to={`/aktivity/${item.activity.id}`} className={buttonSmall}>
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
    <button className={buttonSmall} onClick={() => void onClick()}>
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
        placeholder="Nová misia na tento deň"
        className={input}
        enterKeyHint="done"
      />
      <button type="submit" className={buttonPrimary} disabled={!title.trim()}>
        +
      </button>
    </form>
  )
}
