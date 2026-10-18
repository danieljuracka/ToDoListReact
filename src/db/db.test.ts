import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, LEGACY_DB_NAME, migrateLegacyDb, TodoDb } from './db'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await Dexie.delete(LEGACY_DB_NAME)
})

async function createLegacy(title: string) {
  const legacy = new TodoDb(LEGACY_DB_NAME)
  await legacy.activities.add({
    id: 'a',
    title,
    priority: 'medium',
    recurrence: { type: 'daily', interval: 1 },
    startDate: '2026-10-01',
    skipDates: [],
    carryOver: false,
    createdAt: 0,
  })
  await legacy.settings.put({ key: 'app', theme: 'system', defaultCarryOver: false })
  legacy.close()
}

describe('migrateLegacyDb', () => {
  it('presunie dáta zo starej databázy a starú zmaže', async () => {
    await createLegacy('Beh')
    await migrateLegacyDb()
    expect((await db.activities.toArray()).map((a) => a.title)).toEqual(['Beh'])
    expect((await db.settings.get('app'))?.defaultCarryOver).toBe(false)
    expect(await Dexie.exists(LEGACY_DB_NAME)).toBe(false)
  })

  it('neprepíše dáta, ktoré už nová databáza má', async () => {
    await db.activities.add({
      id: 'b',
      title: 'Nové',
      priority: 'medium',
      recurrence: { type: 'daily', interval: 1 },
      startDate: '2026-10-01',
      skipDates: [],
      carryOver: false,
      createdAt: 0,
    })
    await createLegacy('Staré')
    await migrateLegacyDb()
    expect((await db.activities.toArray()).map((a) => a.title)).toEqual(['Nové'])
  })

  it('bez starej databázy nerobí nič', async () => {
    await migrateLegacyDb()
    expect(await db.activities.count()).toBe(0)
  })
})
