import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { buttonDanger, buttonPrimary, buttonSecondary, checkbox, input, label } from '@/components/ui'
import { db } from '@/db/db'
import { deleteActivity, saveActivity } from '@/db/days'
import { getSettings } from '@/db/settings'
import { formatDayTitle } from '@/domain/dates'
import { WEEKDAY_SHORT } from '@/domain/describe'
import { nextOccurrences } from '@/domain/recurrence'
import type { Activity, Priority, RecurrenceRule, Weekday } from '@/domain/types'
import { useToday } from '@/hooks/useToday'

type RuleType = RecurrenceRule['type']

const RULE_LABELS: Record<RuleType, string> = {
  onDemand: 'Podľa potreby',
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

function defaultRule(type: RuleType): RecurrenceRule {
  switch (type) {
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
  // „Podľa potreby“ nemá čas ani koniec; skryté hodnoty by ovplyvnili radenie.
  const setRule = (rule: RecurrenceRule) =>
    set({ recurrence: rule, ...(rule.type === 'onDemand' ? { timeOfDay: undefined, endDate: undefined } : {}) })
  const rule = form.recurrence
  const onDemand = rule.type === 'onDemand'
  const usePriority = settings?.usePriority ?? true
  const preview = nextOccurrences(form, today, 5)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    await saveActivity({ ...form, title: form.title.trim() }, today)
    goBack()
  }

  const remove = async () => {
    if (!confirm('Zmazať aktivitu? Zmizne z dneška aj budúcich dní, splnené misie v histórii ostanú.')) return
    await deleteActivity(form.id, today)
    navigate('/aktivity')
  }

  return (
    <form onSubmit={submit} className="space-y-4 pt-4">
      <h1 className="heading text-2xl">{id ? 'Upraviť aktivitu' : 'Nová aktivita'}</h1>

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

      {(usePriority || !onDemand) && (
        <div className={`grid gap-3 ${usePriority && !onDemand ? 'grid-cols-2' : ''}`}>
          {usePriority && (
            <Field title="Priorita">
              <select className={input} value={form.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
                <option value="low">Nízka (rank C)</option>
                <option value="medium">Stredná (rank B)</option>
                <option value="high">Vysoká (rank A)</option>
              </select>
            </Field>
          )}
          {!onDemand && (
            <Field title="Čas (voliteľné)">
              <input
                type="time"
                className={input}
                value={form.timeOfDay ?? ''}
                onChange={(e) => set({ timeOfDay: e.target.value || undefined })}
              />
            </Field>
          )}
        </div>
      )}

      <Field title="Opakovanie">
        <select className={input} value={rule.type} onChange={(e) => setRule(defaultRule(e.target.value as RuleType))}>
          {Object.entries(RULE_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </Field>

      <RuleEditor rule={rule} onChange={setRule} />

      {!onDemand && (
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

      <label className="flex items-center justify-between panel p-3">
        <span>Preniesť nesplnenú na ďalší deň</span>
        <input
          type="checkbox"
          className={checkbox}
          checked={form.carryOver}
          onChange={(e) => set({ carryOver: e.target.checked })}
        />
      </label>

      <div className="panel p-3 text-sm">
        <div className={label}>Najbližšie výskyty</div>
        {onDemand ? (
          <p className="text-muted">Zobrazí sa iba v dni, do ktorých ju pridáš na obrazovke dňa.</p>
        ) : preview.length ? (
          <ul className="text-ink/80">
            {preview.map((d) => (
              <li key={d} className="first-letter:uppercase">
                {formatDayTitle(d)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">V najbližších 2 rokoch žiadny.</p>
        )}
        {rule.type === 'timesPerWeek' && (
          <p className="mt-1 text-muted">Zobrazuje sa každý deň, kým v týždni nie je splnená {rule.count}×.</p>
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
        <div className="border-t border-line pt-4">
          <button type="button" className={`${buttonDanger} w-full`} onClick={() => void remove()}>
            Zmazať aktivitu
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
                className={`shape-sm flex-1 border py-2 text-sm font-semibold ${
                  rule.weekdays.includes(d) ? 'border-line bg-accent text-surface' : 'border-line bg-surface text-muted'
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
