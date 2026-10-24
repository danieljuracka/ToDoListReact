import { startOfISOWeek } from 'date-fns'
import { addDaysISO, parseISODate, toISODate } from '@/domain/dates'
import { matchesRule, occursOn } from '@/domain/recurrence'
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
// Vypnutá priorita sa nezobrazuje, preto nesmie ovplyvniť ani poradie.
function compareItems(a: DayItem, b: DayItem, usePriority: boolean): number {
  return (
    (a.timeOfDay ?? '99:99').localeCompare(b.timeOfDay ?? '99:99') ||
    (usePriority ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : 0) ||
    a.title.localeCompare(b.title, 'sk')
  )
}

/** Zoznam úloh pre deň. Iba číta, preto sa dá použiť v useLiveQuery. */
export async function getDayView(date: ISODate, today: ISODate, usePriority = true): Promise<DayItem[]> {
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

  return items.sort((a, b) => compareItems(a, b, usePriority))
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

export type AddToDayResult = 'added' | 'reopened' | 'alreadyPresent'

/**
 * Pridá existujúcu aktivitu akéhokoľvek typu na deň (F5). Cyklus aktivity sa nemení,
 * ručný výskyt sa zobrazí aj mimo neho.
 */
export async function addActivityToDay(activityId: string, date: ISODate, today: ISODate): Promise<AddToDayResult> {
  return db.transaction('rw', db.activities, db.occurrences, async () => {
    const activity = await db.activities.get(activityId)
    if (!activity) throw new Error('Aktivita neexistuje.')
    const existing = await db.occurrences.get(occurrenceId(activityId, date))
    if (existing) {
      if (existing.status === 'open' || existing.status === 'done') return 'alreadyPresent'
      await db.occurrences.update(existing.id, { status: 'open', manual: true, completedAt: undefined })
      return 'reopened'
    }
    // Budúci deň z cyklu je v zozname ako náhľad.
    if (date > today && occursOn(activity, date)) return 'alreadyPresent'
    const order = await db.occurrences.where('date').equals(date).count()
    await db.occurrences.put({ ...newOccurrence(activity, date, order), manual: true })
    return 'added'
  })
}

/** Vytvorí aktivitu „Podľa potreby“ a pridá ju na deň (F5). */
export async function createAndAddActivity(title: string, date: ISODate, today: ISODate): Promise<void> {
  const { defaultCarryOver } = await getSettings()
  const activity: Activity = {
    id: crypto.randomUUID(),
    title,
    priority: 'medium',
    recurrence: { type: 'onDemand' },
    startDate: date,
    skipDates: [],
    carryOver: defaultCarryOver,
    createdAt: Date.now(),
  }
  await db.transaction('rw', db.activities, db.occurrences, async () => {
    await db.activities.add(activity)
    await addActivityToDay(activity.id, date, today)
  })
}

/**
 * Odoberie aktivitu z dňa; aktivita ani cyklus sa nemaže. Ak deň patrí do cyklu,
 * pribudne do skipDates, inak by sa výskyt vytvoril alebo zobrazil znova.
 * Splnené a presunuté výskyty ostávajú v histórii.
 */
export async function removeFromDay(activityId: string, date: ISODate): Promise<void> {
  await db.transaction('rw', db.activities, db.occurrences, async () => {
    const id = occurrenceId(activityId, date)
    const existing = await db.occurrences.get(id)
    if (existing && existing.status !== 'open' && existing.status !== 'skipped') return
    if (existing) await db.occurrences.delete(id)
    const activity = await db.activities.get(activityId)
    // occursOn by skipDates už zohľadnil, preto priamo pravidlo.
    if (
      activity &&
      !activity.skipDates.includes(date) &&
      matchesRule(activity.recurrence, parseISODate(activity.startDate), parseISODate(date))
    ) {
      await db.activities.update(activityId, { skipDates: [...activity.skipDates, date] })
    }
  })
}

/**
 * Odstráni nesplnené výskyty aktivity od dneška, aby sa prepočítali podľa nových pravidiel.
 * Bez `all` ostanú prenesené a ručne pridané výskyty, ktoré z pravidiel nevznikli.
 */
async function dropOpenFromToday(activityId: string, today: ISODate, all: boolean) {
  await db.occurrences
    .where('[activityId+date]')
    .between([activityId, today], [activityId, '9999-12-31'], true, true)
    .filter((o) => o.status === 'open' && (all || (!o.carriedFrom && !o.manual)))
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
