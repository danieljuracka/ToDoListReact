import type { Activity, Category, DayNote, Occurrence, Settings } from '@/domain/types'
import { db } from './db'

const APP_ID = 'denny-todo'

export interface Backup {
  app: typeof APP_ID
  version: 1
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
  return { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), activities, occurrences, categories, days, settings }
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text) as Partial<Backup>
  const lists = ['activities', 'occurrences', 'categories', 'days', 'settings'] as const
  if (data.app !== APP_ID || data.version !== 1 || lists.some((key) => !Array.isArray(data[key]))) {
    throw new Error('Súbor nie je záloha tejto aplikácie.')
  }
  return data as Backup
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
