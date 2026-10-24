import { todayISO } from '@/domain/dates'
import { migrateOnceActivity, type StoredActivity } from '@/domain/legacy'
import type { Activity, Category, DayNote, Occurrence, Settings } from '@/domain/types'
import { db } from './db'

const APP_ID = 'denny-todo'

/** Verzia 2: typ „Jednorazovo“ (once) nahradil typ „Podľa potreby“ (onDemand). */
const VERSION = 2

export interface Backup {
  app: typeof APP_ID
  version: typeof VERSION
  exportedAt: string
  activities: Activity[]
  occurrences: Occurrence[]
  categories: Category[]
  days: DayNote[]
  settings: Settings[]
}

export async function exportBackup(): Promise<Backup> {
  const [activities, occurrences, categories, days, settings] = await Promise.all([
    db.activities.toArray(),
    db.occurrences.toArray(),
    db.categories.toArray(),
    db.days.toArray(),
    db.settings.toArray(),
  ])
  return { app: APP_ID, version: VERSION, exportedAt: new Date().toISOString(), activities, occurrences, categories, days, settings }
}

export function parseBackup(text: string, today: string = todayISO()): Backup {
  const data = JSON.parse(text) as Omit<Partial<Backup>, 'version'> & { version?: number }
  const lists = ['activities', 'occurrences', 'categories', 'days', 'settings'] as const
  if (data.app !== APP_ID || (data.version !== 1 && data.version !== VERSION) || lists.some((key) => !Array.isArray(data[key]))) {
    throw new Error('Súbor nie je záloha tejto aplikácie.')
  }
  const backup = data as Backup
  return data.version === 1 ? upgradeFromV1(backup, today) : backup
}

function upgradeFromV1(backup: Backup, today: string): Backup {
  const occurrences = [...backup.occurrences]
  const ids = new Set(occurrences.map((o) => o.id))
  const activities = (backup.activities as StoredActivity[]).map((stored) => {
    const { activity, occurrence } = migrateOnceActivity(stored, today)
    if (occurrence && !ids.has(occurrence.id)) {
      const order = occurrences.filter((o) => o.date === occurrence.date).length
      occurrences.push({ ...occurrence, order })
      ids.add(occurrence.id)
    }
    return activity
  })
  return { ...backup, version: VERSION, activities, occurrences }
}

/** Nahradí všetky dáta v zariadení obsahom zálohy. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await db.activities.bulkAdd(backup.activities)
    await db.occurrences.bulkAdd(backup.occurrences)
    await db.categories.bulkAdd(backup.categories)
    await db.days.bulkAdd(backup.days)
    await db.settings.bulkAdd(backup.settings)
  })
}
