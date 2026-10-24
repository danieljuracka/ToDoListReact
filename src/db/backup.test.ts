import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, parseBackup, restoreBackup } from './backup'
import { db } from './db'
import { createAndAddActivity } from './days'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('záloha', () => {
  it('export a import do prázdnej databázy obnoví aktivity aj históriu', async () => {
    await createAndAddActivity('Zavolať', '2026-10-18', '2026-10-18')
    const text = JSON.stringify(await exportBackup())
    await Promise.all(db.tables.map((t) => t.clear()))

    await restoreBackup(parseBackup(text))
    expect(await db.activities.count()).toBe(1)
    expect((await db.occurrences.toArray()).map((o) => o.titleSnapshot)).toEqual(['Zavolať'])
  })

  it('záloha verzie 1 prevedie jednorazové aktivity a zachová budúcu misiu', () => {
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
    const text = JSON.stringify({
      app: 'denny-todo',
      version: 1,
      exportedAt: '',
      activities: [once('minula', '2026-10-10'), once('buduca', '2026-10-25')],
      occurrences: [],
      categories: [],
      days: [],
      settings: [],
    })
    const backup = parseBackup(text, '2026-10-18')
    expect(backup.version).toBe(2)
    expect(backup.activities.map((a) => a.recurrence.type)).toEqual(['onDemand', 'onDemand'])
    expect(backup.occurrences.map((o) => [o.id, o.manual])).toEqual([['buduca_2026-10-25', true]])
  })

  it('odmietne cudzí súbor', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow('Súbor nie je záloha tejto aplikácie.')
  })
})
