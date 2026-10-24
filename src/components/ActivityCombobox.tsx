import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { db } from '@/db/db'
import { addActivityToDay, createAndAddActivity } from '@/db/days'
import { describeRule } from '@/domain/describe'
import { normalizeText } from '@/domain/text'
import type { Activity, ISODate } from '@/domain/types'
import { RankBadge } from './Ninja'
import { buttonPrimary, input } from './ui'

type Option = { kind: 'activity'; activity: Activity; disabled: boolean } | { kind: 'create'; title: string }

const isDisabled = (option: Option) => option.kind === 'activity' && option.disabled

/** Presná zhoda názvu; pri viacerých má prednosť aktivita „Podľa potreby“, aby nevznikali duplikáty. */
function findExact(sorted: Activity[], query: string): Activity | undefined {
  const matches = sorted.filter((a) => normalizeText(a.title) === query)
  return matches.find((a) => a.recurrence.type === 'onDemand') ?? matches[0]
}

/**
 * Pridanie misie na deň (F5): text filtruje zoznam všetkých aktivít, výber pridá
 * existujúcu aktivitu, inak sa vytvorí nová „Podľa potreby“.
 */
export function ActivityCombobox({
  date,
  today,
  presentIds,
  usePriority,
}: {
  date: ISODate
  today: ISODate
  /** Aktivity, ktoré už v tomto dni sú. */
  presentIds: Set<string>
  usePriority: boolean
}) {
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const [text, setText] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const [active, setActive] = useState(-1)
  const [message, setMessage] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const listId = useId()

  const sorted = useMemo(
    () => [...(activities ?? [])].sort((a, b) => a.title.localeCompare(b.title, 'sk')),
    [activities],
  )
  const query = normalizeText(text)
  const selected = sorted.find((a) => a.id === selectedId)
  const target = selected ?? (query ? findExact(sorted, query) : undefined)
  const targetPresent = !!target && presentIds.has(target.id)
  const options: Option[] = [
    ...sorted
      .filter((a) => normalizeText(a.title).includes(query))
      .map((activity): Option => ({ kind: 'activity', activity, disabled: presentIds.has(activity.id) })),
    ...(query && !target ? [{ kind: 'create', title: text.trim() } as const] : []),
  ]
  const expanded = open && options.length > 0
  const optionId = (i: number) => `${listId}-${i}`

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  })

  const openList = () => {
    // Pole je na konci stránky a na mobile ho prekryje klávesnica, preto zoznam radšej nad ním.
    const rect = inputRef.current?.getBoundingClientRect()
    const viewport = window.visualViewport?.height ?? window.innerHeight
    setAbove(!!rect && viewport - rect.bottom < 320)
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setActive(-1)
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const title = text.trim()
    // Druhý Enter počas ukladania by vytvoril duplicitnú aktivitu.
    if (!title || targetPresent || busy.current) return
    busy.current = true
    try {
      if (target) {
        if ((await addActivityToDay(target.id, date, today)) === 'alreadyPresent') {
          setMessage('Misia už je v tomto dni.')
          return
        }
      } else {
        await createAndAddActivity(title, date, today)
      }
    } finally {
      busy.current = false
    }
    setText('')
    setSelectedId(undefined)
    setMessage(undefined)
    close()
    inputRef.current?.focus()
  }

  const choose = (option: Option) => {
    if (option.kind === 'create') return void submit()
    if (option.disabled) return
    setText(option.activity.title)
    setSelectedId(option.activity.id)
    setMessage(undefined)
    close()
  }

  const move = (dir: 1 | -1) => {
    if (!expanded) openList()
    let i = active < 0 ? (dir > 0 ? -1 : 0) : active
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length
      if (!isDisabled(options[i])) return setActive(i)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(e.key === 'ArrowDown' ? 1 : -1)
    } else if (e.key === 'Enter' && expanded && active >= 0) {
      e.preventDefault()
      choose(options[active])
    } else if (e.key === 'Escape') {
      close()
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-6">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setSelectedId(undefined)
              setMessage(undefined)
              setActive(-1)
              if (!open) openList()
            }}
            // Nie pri fokuse: po pridaní sa fokus vracia do poľa a zoznam má ostať zavretý.
            onClick={openList}
            onBlur={close}
            onKeyDown={onKeyDown}
            placeholder="Vyber alebo napíš misiu"
            className={`${input} pr-10`}
            enterKeyHint="done"
            autoComplete="off"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={expanded ? 'Zavrieť zoznam aktivít' : 'Otvoriť zoznam aktivít'}
            className="absolute inset-y-0 right-0 px-3 text-muted"
            // Fokus ostáva v poli, inak by sa zoznam po blur hneď zavrel.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (expanded) return close()
              inputRef.current?.focus()
              openList()
            }}
          >
            ▾
          </button>
          {expanded && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Aktivity"
              className={`shape-sm absolute inset-x-0 z-20 max-h-60 overflow-y-auto border-2 border-line bg-surface shadow-ink ${
                above ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            >
              {options.map((option, i) => (
                <li
                  key={option.kind === 'activity' ? option.activity.id : 'create'}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={isDisabled(option)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(option)}
                  className={`flex items-center gap-2 px-3 py-2.5 ${i === active ? 'bg-surface-hi' : ''} ${
                    isDisabled(option) ? 'text-muted' : 'cursor-pointer active:bg-surface-hi'
                  }`}
                >
                  {option.kind === 'activity' ? (
                    <>
                      {usePriority && <RankBadge priority={option.activity.priority} />}
                      <span className="min-w-0 flex-1 truncate font-bold">{option.activity.title}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {option.disabled ? 'už je v tomto dni' : describeRule(option.activity.recurrence)}
                      </span>
                    </>
                  ) : (
                    <span className="min-w-0 flex-1 truncate font-bold text-accent">＋ Vytvoriť „{option.title}“</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          aria-label="Pridať misiu na tento deň"
          className={buttonPrimary}
          disabled={!text.trim() || targetPresent}
        >
          +
        </button>
      </div>
      {(message || targetPresent) && (
        <p role="status" className="mt-1 text-sm text-muted">
          {message ?? 'Misia už je v tomto dni.'}
        </p>
      )}
    </form>
  )
}
