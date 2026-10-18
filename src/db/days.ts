import { startOfISOWeek } from 'date-fns'
import { addDaysISO, parseISODate, toISODate } from '@/domain/dates'
import { occursOn } from '@/domain/recurrence'
import type { Activity, ISODate, Occurrence, OccurrenceStatus, Priority } from '@/domain/types'
import { db } from './db'
import { getSettings, updateSettings } from './settings'

// Dnešok a minulé dni sa ukladajú do histórie (occurrences). Budúce dni sa iba
// vypočítajú z pravidiel, okrem úloh, ktoré na ne niekto ručne presunul.

/** Na koľko dní dozadu sa doplní história, ak aplikácia dlho nebola otvorená. */
const MAX_CATCH_UP_DAYS = 400

export interface DayItem {
  key: string
  /** Uložený výskyt; chýba pri budúcich dňoch, ktoré sú len náhľadom. */
  occurrence?: Occurrence
  activity?: Activity
  title: string
  status: OccurrenceStatus
  timeOfDay?: string
  priority: Priority
  carriedFrom?: ISODate
}

export interface DayStats {
  done: number
  total: number
}

const occurrenceId = (activityId: string, date: ISODate) => `${activityId}_${date}`

function newOccurrence(activity: Activity, date: ISODate, order: number, carriedFrom?: ISODate): Occurrence {
  return {
    id: occurrenceId(activity.id, date),
    date,
    activityId: activity.id,
    titleSnapshot: activity.title,
    status: 'open',
    order,
    carriedFrom,
  }
}

async function weeklyQuotaReached(activity: Activity, date: ISODate): Promise<boolean> {
  if (activity.recurrence.type !== 'timesPerWeek') return false
  const weekStart = toISODate(startOfISOWeek(parseISODate(date)))
  const done = await db.occurrences
    .where('[activityId+date]')
    .between([activity.id, weekStart], [activity.id, date])
    .filter((o) => o.status === 'done')
    .count()
  return done >= activity.recurrence.count
}

/**
 * Uloží zoznam pre daný deň: prenesie nesplnené úlohy z predchádzajúceho dňa
 * a doplní výskyty z pravidiel. Opakované volanie nič nezdvojí.
 */
export async function materializeDay(date: ISODate): Promise<void> {
  const prev = addDaysISO(date, -1)
  await db.transaction('rw', db.activities, db.occurrences, async () => {
    const [activities, existing, prevOccurrences] = await Promise.all([
      db.activities.toArray(),
      db.occurrences.where('date').equals(date).toArray(),
      db.occurrences.where('date').equals(prev).toArray(),
    ])
    const byId = new Map(activities.map((a) => [a.id, a]))
    const present = new Set(existing.map((o) => o.activityId))
    const toAdd: Occurrence[] = []
    let order = existing.length

    for (const o of prevOccurrences) {
      const activity = byId.get(o.activityId)
      if (o.status !== 'open' || !activity?.carryOver) continue
      await db.occurrences.update(o.id, { status: 'carried' })
      if (!present.has(activity.id)) {
        toAdd.push(newOccurrence(activity, date, order++, o.carriedFrom ?? prev))
        present.add(activity.id)
      }
    }

    for (const activity of activities) {
      if (present.has(activity.id) || !occursOn(activity, date)) continue
      if (await weeklyQuotaReached(activity, date)) continue
      toAdd.push(newOccurrence(activity, date, order++))
      present.add(activity.id)
    }

    await db.occurrences.bulkPut(toAdd)
  })
}

/** Doplní históriu od posledného otvorenia aplikácie po dnešok. */
export async function materializeUpTo(today: ISODate): Promise<void> {
  const { lastMaterialized } = await getSettings()
  if (lastMaterialized === today) return
  let date = today
  if (lastMaterialized && lastMaterialized < today) {
    date = addDaysISO(lastMaterialized, 1)
    const earliest = addDaysISO(today, -MAX_CATCH_UP_DAYS)
    if (date < earliest) date = earliest
  }
  for (; date <= today; date = addDaysISO(date, 1)) {
    await materializeDay(date)
  }
  await updateSettings({ lastMaterialized: today })
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

// Poradie nezávisí od stavu, aby sa zoznam po odškrtnutí nepreusporiadal pod prstom.
function compareItems(a: DayItem, b: DayItem): number {
  return (
    (a.timeOfDay ?? '99:99').localeCompare(b.timeOfDay ?? '99:99') ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.title.localeCompare(b.title, 'sk')
  )
}

/** Zoznam úloh pre deň. Iba číta, preto sa dá použiť v useLiveQuery. */
export async function getDayView(date: ISODate, today: ISODate): Promise<DayItem[]> {
  const [activities, stored] = await Promise.all([
    db.activities.toArray(),
    db.occurrences.where('date').equals(date).toArray(),
  ])
  const byId = new Map(activities.map((a) => [a.id, a]))
  const items: DayItem[] = stored.map((o) => {
    const activity = byId.get(o.activityId)
    return {
      key: o.id,
      occurrence: o,
      activity,
      title: o.titleSnapshot,
      status: o.status,
      timeOfDay: activity?.timeOfDay,
      priority: activity?.priority ?? 'medium',
      carriedFrom: o.carriedFrom,
    }
  })

  if (date > today) {
    const present = new Set(stored.map((o) => o.activityId))
    for (const activity of activities) {
      if (present.has(activity.id) || !occursOn(activity, date)) continue
      items.push({
        key: occurrenceId(activity.id, date),
        activity,
        title: activity.title,
        status: 'open',
        timeOfDay: activity.timeOfDay,
        priority: activity.priority,
      })
    }
  }

  return items.sort(compareItems)
}

export function dayStats(items: Pick<DayItem, 'status'>[]): DayStats {
  const counted = items.filter((i) => i.status === 'open' || i.status === 'done')
  return { done: counted.filter((i) => i.status === 'done').length, total: counted.length }
}

/** Štatistiky splnenia pre každý uložený deň v rozsahu (vrátane). */
export async function rangeStats(from: ISODate, to: ISODate): Promise<Map<ISODate, DayStats>> {
  const occurrences = await db.occurrences.where('date').between(from, to, true, true).toArray()
  const byDate = new Map<ISODate, Occurrence[]>()
  for (const o of occurrences) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o])
  return new Map([...byDate].map(([date, list]) => [date, dayStats(list)]))
}

export async function setStatus(occurrenceIdValue: string, status: OccurrenceStatus): Promise<void> {
  await db.occurrences.update(occurrenceIdValue, {
    status,
    completedAt: status === 'done' ? Date.now() : undefined,
  })
}

/** Ručný presun úlohy na iný deň (predvolene zajtra). */
export async function moveOccurrence(occurrence: Occurrence, to: ISODate): Promise<void> {
  await db.transaction('rw', db.occurrences, async () => {
    await db.occurrences.update(occurrence.id, { status: 'carried' })
    const id = occurrenceId(occurrence.activityId, to)
    if (await db.occurrences.get(id)) return
    const order = await db.occurrences.where('date').equals(to).count()
    await db.occurrences.put({
      id,
      date: to,
      activityId: occurrence.activityId,
      titleSnapshot: occurrence.titleSnapshot,
      status: 'open',
      order,
      carriedFrom: occurrence.carriedFrom ?? occurrence.date,
    })
  })
}

/** Rýchle pridanie jednorazovej úlohy na konkrétny deň (F5). */
export async function addQuickTask(title: string, date: ISODate, today: ISODate): Promise<void> {
  const { defaultCarryOver } = await getSettings()
  const activity: Activity = {
    id: crypto.randomUUID(),
    title,
    priority: 'medium',
    recurrence: { type: 'once', date },
    startDate: date,
    skipDates: [],
    carryOver: defaultCarryOver,
    createdAt: Date.now(),
  }
  await db.transaction('rw', db.activities, db.occurrences, async () => {
    await db.activities.add(activity)
    if (date <= today) {
      const order = await db.occurrences.where('date').equals(date).count()
      await db.occurrences.put(newOccurrence(activity, date, order))
    }
  })
}

/** Odstráni nesplnené výskyty aktivity od dneška, aby sa prepočítali podľa nových pravidiel. */
async function dropOpenFromToday(activityId: string, today: ISODate, includeCarried: boolean) {
  await db.occurrences
    .where('[activityId+date]')
    .between([activityId, today], [activityId, '9999-12-31'], true, true)
    .filter((o) => o.status === 'open' && (includeCarried || !o.carriedFrom))
    .delete()
}

/** Uloží aktivitu; zmena platí od dneška, história ostáva nezmenená. */
export async function saveActivity(activity: Activity, today: ISODate): Promise<void> {
  await db.transaction('rw', db.activities, db.occurrences, async () => {
    await db.activities.put(activity)
    await dropOpenFromToday(activity.id, today, false)
  })
  await materializeDay(today)
}

/**
 * Zmaže aktivitu. Z dneška a budúcich dní zmiznú jej nesplnené výskyty,
 * história (splnené, preskočené a minulé dni) ostáva pod pôvodným názvom.
 */
export async function deleteActivity(activityId: string, today: ISODate): Promise<void> {
  await db.transaction('rw', db.activities, db.occurrences, async () => {
    await dropOpenFromToday(activityId, today, true)
    await db.activities.delete(activityId)
  })
}
