import Dexie, { type EntityTable } from 'dexie'
import type { Activity, Category, DayNote, Occurrence, Settings } from '@/domain/types'

// Všetky dáta sú iba v IndexedDB tohto zariadenia – žiadny server ani synchronizácia.
export class TodoDb extends Dexie {
  activities!: EntityTable<Activity, 'id'>
  occurrences!: EntityTable<Occurrence, 'id'>
  categories!: EntityTable<Category, 'id'>
  days!: EntityTable<DayNote, 'date'>
  settings!: EntityTable<Settings, 'key'>

  constructor() {
    // Bez vyrovnávacej pamäte dotazov: na Androide sa po zápise nezobrazovali zmeny až do reštartu.
    super('todo', { cache: 'disabled' })
    // Pri zmene schémy pridať this.version(2).stores({...}) s migráciou, nemeniť verziu 1.
    this.version(1).stores({
      activities: 'id, categoryId',
      occurrences: 'id, date, activityId, [activityId+date]',
      categories: 'id, order',
      days: 'date',
      settings: 'key',
    })
  }
}

export const db = new TodoDb()

/** Požiada prehliadač, aby dáta nemazal pri nedostatku miesta. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  return (await navigator.storage.persisted()) || navigator.storage.persist()
}
