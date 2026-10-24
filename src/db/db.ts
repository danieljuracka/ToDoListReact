import Dexie, { type EntityTable } from 'dexie'
import { todayISO } from '@/domain/dates'
import { migrateOnceActivity, type StoredActivity } from '@/domain/legacy'
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
    // Pri zmene schémy pridať ďalšiu verziu s migráciou, existujúce verzie nemeniť.
    this.version(1).stores(SCHEMA_V1)
    // Typ „Jednorazovo“ (once) nahradil typ „Podľa potreby“ (onDemand), indexy sa nemenia.
    this.version(2)
      .stores(SCHEMA_V1)
      .upgrade(async (tx) => {
        const today = todayISO()
        const occurrences = tx.table<Occurrence, string>('occurrences')
        const stored = await tx.table<StoredActivity, string>('activities').toArray()
        for (const item of stored) {
          if (item.recurrence.type !== 'once') continue
          const { activity, occurrence } = migrateOnceActivity(item, today)
          await tx.table('activities').put(activity)
          if (occurrence && !(await occurrences.get(occurrence.id))) {
            const order = await occurrences.where('date').equals(occurrence.date).count()
            await occurrences.put({ ...occurrence, order })
          }
        }
      })
  }
}

const SCHEMA_V1 = {
  activities: 'id, categoryId',
  occurrences: 'id, date, activityId, [activityId+date]',
  categories: 'id, order',
  days: 'date',
  settings: 'key',
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
