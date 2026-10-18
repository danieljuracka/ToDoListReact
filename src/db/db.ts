import Dexie, { type EntityTable } from 'dexie'
import type { Activity, Category, DayNote, Occurrence, Settings } from '@/domain/types'

/**
 * Názov databázy musí byť unikátny v rámci domény – všetky GitHub Pages projekty
 * zdieľajú doménu danieljuracka.github.io a tým aj IndexedDB.
 */
export const DB_NAME = 'sk.juracka.denny-todo'

/** Pôvodný názov z verzií pred premenovaním. */
export const LEGACY_DB_NAME = 'todo'

// Všetky dáta sú iba v IndexedDB tohto zariadenia – žiadny server ani synchronizácia.
export class TodoDb extends Dexie {
  activities!: EntityTable<Activity, 'id'>
  occurrences!: EntityTable<Occurrence, 'id'>
  categories!: EntityTable<Category, 'id'>
  days!: EntityTable<DayNote, 'date'>
  settings!: EntityTable<Settings, 'key'>

  constructor(name = DB_NAME) {
    // Bez vyrovnávacej pamäte dotazov: na Androide sa po zápise nezobrazovali zmeny až do reštartu.
    super(name, { cache: 'disabled' })
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

/**
 * Jednorazovo presunie dáta zo starej databázy `todo` do novej a starú zmaže.
 * Ak už nová databáza obsahuje dáta, nič neprepíše.
 */
export async function migrateLegacyDb(): Promise<void> {
  if (!(await Dexie.exists(LEGACY_DB_NAME))) return
  const legacy = new TodoDb(LEGACY_DB_NAME)
  try {
    const isEmpty = (await db.activities.count()) === 0 && (await db.occurrences.count()) === 0
    if (isEmpty) {
      // Najprv všetko prečítať – v transakcii novej databázy sa nedá čakať na inú databázu.
      const data = await Promise.all(legacy.tables.map(async (t) => [t.name, await t.toArray()] as const))
      await db.transaction('rw', db.tables, async () => {
        for (const [name, rows] of data) await db.table(name).bulkPut(rows)
      })
    }
  } finally {
    legacy.close()
  }
  await Dexie.delete(LEGACY_DB_NAME)
}

/** Požiada prehliadač, aby dáta nemazal pri nedostatku miesta. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  return (await navigator.storage.persisted()) || navigator.storage.persist()
}
