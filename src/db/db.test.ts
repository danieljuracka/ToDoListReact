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
  await legacy.settings.put({ key: 'app', theme: 'system', defaultCarryOver: false, usePriority: true })
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

describe('verzia 2', () => {
  it('jednorazové aktivity prevedie na podľa potreby a zachová budúcu misiu', async () => {
    const name = 'test-v1'
    await Dexie.delete(name)
    const v1 = new Dexie(name)
    v1.version(1).stores({ activities: 'id, categoryId', occurrences: 'id, date, activityId, [activityId+date]' })
    const once = (id: string, date: string) => ({
      id,
      title: id,
      priority: 'medium',
      recurrence: { type: 'once', date },
      startDate: date,
      skipDates: [],
      carryOver: false,
      createdAt: 0,
    })
    await v1.table('activities').bulkAdd([once('minula', '2000-01-01'), once('buduca', '2999-01-01')])
    v1.close()

    const upgraded = new TodoDb(name)
    const activities = await upgraded.activities.orderBy('id').toArray()
    expect(activities.map((a) => [a.id, a.recurrence.type])).toEqual([
      ['buduca', 'onDemand'],
      ['minula', 'onDemand'],
    ])
    const occurrences = await upgraded.occurrences.toArray()
    expect(occurrences.map((o) => [o.id, o.status, o.manual])).toEqual([['buduca_2999-01-01', 'open', true]])
    upgraded.close()
    await Dexie.delete(name)
  })
})
