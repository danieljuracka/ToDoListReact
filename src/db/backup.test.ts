import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, parseBackup, restoreBackup } from './backup'
import { db } from './db'
import { addQuickTask } from './days'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('záloha', () => {
  it('export a import do prázdnej databázy obnoví aktivity aj históriu', async () => {
    await addQuickTask('Zavolať', '2026-10-18', '2026-10-18')
    const text = JSON.stringify(await exportBackup())
    await Promise.all(db.tables.map((t) => t.clear()))

    await restoreBackup(parseBackup(text))
    expect(await db.activities.count()).toBe(1)
    expect((await db.occurrences.toArray()).map((o) => o.titleSnapshot)).toEqual(['Zavolať'])
  })

  it('odmietne cudzí súbor', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow('Súbor nie je záloha tejto aplikácie.')
  })
})
