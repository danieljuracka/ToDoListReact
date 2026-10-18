import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { buttonDanger, buttonPrimary, buttonSecondary, input, label } from '@/components/ui'
import { db } from '@/db/db'
import { deleteActivity, saveActivity, setArchived } from '@/db/days'
import { getSettings } from '@/db/settings'
import { formatDayTitle } from '@/domain/dates'
import { WEEKDAY_SHORT } from '@/domain/describe'
import { nextOccurrences } from '@/domain/recurrence'
import type { Activity, Priority, RecurrenceRule, Weekday } from '@/domain/types'
import { useToday } from '@/hooks/useToday'

type RuleType = RecurrenceRule['type']

const RULE_LABELS: Record<RuleType, string> = {
  once: 'Jednorazovo',
  daily: 'Denne / každých N dní',
  weekly: 'Týždenne vo vybrané dni',
  monthlyDay: 'Mesačne – deň v mesiaci',
  monthlyNthWeekday: 'Mesačne – napr. posledný piatok',
  yearly: 'Ročne',
  workdays: 'Pracovné dni',
  weekends: 'Víkendy',
  timesPerWeek: 'N-krát za týždeň',
}

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

function defaultRule(type: RuleType, date: string): RecurrenceRule {
  switch (type) {
    case 'once':
      return { type, date }
    case 'daily':
      return { type, interval: 1 }
    case 'weekly':
      return { type, interval: 1, weekdays: [1] }
    case 'monthlyDay':
      return { type, day: 1 }
    case 'monthlyNthWeekday':
      return { type, nth: -1, weekday: 5 }
    case 'yearly':
      return { type, month: 1, day: 1 }
    case 'timesPerWeek':
      return { type, count: 3 }
    default:
      return { type }
  }
}

function emptyActivity(today: string, carryOver: boolean): Activity {
  return {
    id: crypto.randomUUID(),
    title: '',
    priority: 'medium',
    recurrence: { type: 'daily', interval: 1 },
    startDate: today,
    skipDates: [],
    carryOver,
    archived: false,
    createdAt: Date.now(),
  }
}

export function ActivityFormPage() {
  const { id } = useParams()
  const today = useToday()
  const navigate = useNavigate()
  const existing = useLiveQuery(() => (id ? db.activities.get(id) : undefined), [id])
  const settings = useLiveQuery(getSettings, [])
  const [blank] = useState(() => emptyActivity(today, true))
  const [draft, setForm] = useState<Activity>()
  // Kým používateľ nič nezmenil, formulár ukazuje uloženú aktivitu alebo prázdnu šablónu.
  const form = draft ?? (id ? existing : settings && { ...blank, carryOver: settings.defaultCarryOver })

  if (!form) return null

  // Späť tam, odkiaľ používateľ prišiel (Dnes alebo Aktivity); pri priamom otvorení na zoznam.
  const goBack = () => (window.history.state?.idx ? navigate(-1) : navigate('/aktivity'))
  const set = (changes: Partial<Activity>) => setForm({ ...form, ...changes })
  const setRule = (rule: RecurrenceRule) =>
    set({ recurrence: rule, ...(rule.type === 'once' ? { startDate: rule.date } : {}) })
  const rule = form.recurrence
  const preview = nextOccurrences(form, today, 5)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    await saveActivity({ ...form, title: form.title.trim() }, today)
    goBack()
  }

  const archive = async () => {
    await setArchived(form.id, !form.archived, today)
    navigate('/aktivity')
  }

  const remove = async () => {
    if (!confirm('Zmazať aktivitu aj celú jej históriu? Ak chceš históriu zachovať, zvoľ radšej Archivovať.')) return
    await deleteActivity(form.id)
    navigate('/aktivity')
  }

  return (
    <form onSubmit={submit} className="space-y-4 pt-4">
      <h1 className="text-2xl font-bold">{id ? 'Upraviť aktivitu' : 'Nová aktivita'}</h1>

      <Field title="Názov">
        <input className={input} value={form.title} onChange={(e) => set({ title: e.target.value })} required autoFocus={!id} />
      </Field>

      <Field title="Popis">
        <textarea
          className={input}
          rows={2}
          value={form.description ?? ''}
          onChange={(e) => set({ description: e.target.value || undefined })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field title="Priorita">
          <select className={input} value={form.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
            <option value="low">Nízka</option>
            <option value="medium">Stredná</option>
            <option value="high">Vysoká</option>
          </select>
        </Field>
        <Field title="Čas (voliteľné)">
          <input
            type="time"
            className={input}
            value={form.timeOfDay ?? ''}
            onChange={(e) => set({ timeOfDay: e.target.value || undefined })}
          />
        </Field>
      </div>

      <Field title="Opakovanie">
        <select
          className={input}
          value={rule.type}
          onChange={(e) => setRule(defaultRule(e.target.value as RuleType, form.startDate))}
        >
          {Object.entries(RULE_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </Field>

      <RuleEditor rule={rule} onChange={setRule} />

      {rule.type !== 'once' && (
        <div className="grid grid-cols-2 gap-3">
          <Field title="Od">
            <input
              type="date"
              className={input}
              value={form.startDate}
              onChange={(e) => e.target.value && set({ startDate: e.target.value })}
            />
          </Field>
          <Field title="Do (voliteľné)">
            <input
              type="date"
              className={input}
              value={form.endDate ?? ''}
              onChange={(e) => set({ endDate: e.target.value || undefined })}
            />
          </Field>
        </div>
      )}

      <label className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
        <span>Preniesť nesplnenú na ďalší deň</span>
        <input
          type="checkbox"
          className="size-5 accent-blue-600"
          checked={form.carryOver}
          onChange={(e) => set({ carryOver: e.target.checked })}
        />
      </label>

      <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">
        <div className="mb-1 font-medium">Najbližšie výskyty</div>
        {preview.length ? (
          <ul className="text-slate-600 dark:text-slate-400">
            {preview.map((d) => (
              <li key={d} className="first-letter:uppercase">
                {formatDayTitle(d)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">V najbližších 2 rokoch žiadny.</p>
        )}
        {rule.type === 'timesPerWeek' && (
          <p className="mt-1 text-slate-500">Zobrazuje sa každý deň, kým v týždni nie je splnená {rule.count}×.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button type="submit" className={`${buttonPrimary} flex-1`} disabled={!form.title.trim()}>
          Uložiť
        </button>
        <button type="button" className={buttonSecondary} onClick={goBack}>
          Zrušiť
        </button>
      </div>

      {id && existing && (
        <div className="flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button type="button" className={`${buttonSecondary} flex-1`} onClick={() => void archive()}>
            {form.archived ? 'Obnoviť z archívu' : 'Archivovať'}
          </button>
          <button type="button" className={buttonDanger} onClick={() => void remove()}>
            Zmazať
          </button>
        </div>
      )}
    </form>
  )
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      {children}
    </label>
  )
}

function NumberInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={input}
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isInteger(n) && n >= min && n <= max) onChange(n)
      }}
    />
  )
}

function WeekdayPicker({ value, onChange }: { value: Weekday; onChange: (d: Weekday) => void }) {
  return (
    <select className={input} value={value} onChange={(e) => onChange(Number(e.target.value) as Weekday)}>
      {WEEKDAYS.map((d) => (
        <option key={d} value={d}>
          {WEEKDAY_SHORT[d]}
        </option>
      ))}
    </select>
  )
}

function RuleEditor({ rule, onChange }: { rule: RecurrenceRule; onChange: (rule: RecurrenceRule) => void }) {
  switch (rule.type) {
    case 'once':
      return (
        <Field title="Dátum">
          <input
            type="date"
            className={input}
            value={rule.date}
            onChange={(e) => e.target.value && onChange({ ...rule, date: e.target.value })}
          />
        </Field>
      )
    case 'daily':
      return (
        <Field title="Každých N dní">
          <NumberInput value={rule.interval} min={1} max={365} onChange={(interval) => onChange({ ...rule, interval })} />
        </Field>
      )
    case 'weekly': {
      const toggle = (d: Weekday) => {
        const weekdays = rule.weekdays.includes(d) ? rule.weekdays.filter((x) => x !== d) : [...rule.weekdays, d]
        if (weekdays.length) onChange({ ...rule, weekdays })
      }
      return (
        <>
          <div className="flex gap-1">
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggle(d)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                  rule.weekdays.includes(d) ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            ))}
          </div>
          <Field title="Každý N-tý týždeň">
            <NumberInput value={rule.interval} min={1} max={52} onChange={(interval) => onChange({ ...rule, interval })} />
          </Field>
        </>
      )
    }
    case 'monthlyDay':
      return (
        <Field title="Deň v mesiaci (31 = posledný deň kratších mesiacov)">
          <NumberInput value={rule.day} min={1} max={31} onChange={(day) => onChange({ ...rule, day })} />
        </Field>
      )
    case 'monthlyNthWeekday':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field title="Poradie">
            <select
              className={input}
              value={rule.nth}
              onChange={(e) => onChange({ ...rule, nth: Number(e.target.value) as typeof rule.nth })}
            >
              <option value={1}>Prvý</option>
              <option value={2}>Druhý</option>
              <option value={3}>Tretí</option>
              <option value={4}>Štvrtý</option>
              <option value={-1}>Posledný</option>
            </select>
          </Field>
          <Field title="Deň">
            <WeekdayPicker value={rule.weekday} onChange={(weekday) => onChange({ ...rule, weekday })} />
          </Field>
        </div>
      )
    case 'yearly':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field title="Deň">
            <NumberInput value={rule.day} min={1} max={31} onChange={(day) => onChange({ ...rule, day })} />
          </Field>
          <Field title="Mesiac">
            <NumberInput value={rule.month} min={1} max={12} onChange={(month) => onChange({ ...rule, month })} />
          </Field>
        </div>
      )
    case 'timesPerWeek':
      return (
        <Field title="Koľkokrát za týždeň">
          <NumberInput value={rule.count} min={1} max={7} onChange={(count) => onChange({ ...rule, count })} />
        </Field>
      )
    default:
      return null
  }
}
