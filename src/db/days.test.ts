import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Activity, RecurrenceRule } from '@/domain/types'
import { db } from './db'
import {
  addQuickTask,
  deleteActivity,
  getDayView,
  materializeDay,
  materializeUpTo,
  moveOccurrence,
  saveActivity,
  setStatus,
} from './days'

function activity(id: string, recurrence: RecurrenceRule, extra: Partial<Activity> = {}): Activity {
  return {
    id,
    title: id,
    priority: 'medium',
    recurrence,
    startDate: '2026-10-01',
    skipDates: [],
    carryOver: false,
    createdAt: 0,
    ...extra,
  }
}

const daily = { type: 'daily', interval: 1 } as const
const titles = async (date: string, today: string) => (await getDayView(date, today)).map((i) => `${i.title}:${i.status}`)

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('materializeDay', () => {
  it('uloží výskyty podľa pravidiel a opakované volanie nič nezdvojí', async () => {
    await db.activities.add(activity('beh', daily))
    await materializeDay('2026-10-18')
    await materializeDay('2026-10-18')
    expect(await db.occurrences.count()).toBe(1)
  })

  it('prenesie nesplnenú úlohu so zapnutým prenosom, bez prenosu nie', async () => {
    await db.activities.bulkAdd([
      activity('nakup', { type: 'once', date: '2026-10-17' }, { startDate: '2026-10-17', carryOver: true }),
      activity('posta', { type: 'once', date: '2026-10-17' }, { startDate: '2026-10-17' }),
    ])
    await materializeDay('2026-10-17')
    await materializeDay('2026-10-18')
    expect(await titles('2026-10-17', '2026-10-18')).toEqual(['posta:open', 'nakup:carried'])
    const today = await getDayView('2026-10-18', '2026-10-18')
    expect(today.map((i) => [i.title, i.carriedFrom])).toEqual([['nakup', '2026-10-17']])
  })

  it('pri prenose nevytvorí duplicitu, ak má aktivita v nový deň vlastný výskyt', async () => {
    await db.activities.add(activity('beh', daily, { carryOver: true }))
    await materializeDay('2026-10-17')
    await materializeDay('2026-10-18')
    expect(await titles('2026-10-18', '2026-10-18')).toEqual(['beh:open'])
  })

  it('úloha N-krát za týždeň zmizne po splnení kvóty', async () => {
    await db.activities.add(activity('cvicenie', { type: 'timesPerWeek', count: 2 }))
    // pondelok a utorok splnené
    for (const date of ['2026-10-19', '2026-10-20']) {
      await materializeDay(date)
      await setStatus(`cvicenie_${date}`, 'done')
    }
    await materializeDay('2026-10-21')
    expect(await titles('2026-10-21', '2026-10-21')).toEqual([])
    // nový týždeň
    await materializeDay('2026-10-26')
    expect(await titles('2026-10-26', '2026-10-26')).toEqual(['cvicenie:open'])
  })
})

describe('materializeUpTo', () => {
  it('doplní históriu za dni, keď aplikácia nebola otvorená', async () => {
    await db.activities.add(activity('beh', daily))
    await materializeUpTo('2026-10-15')
    await materializeUpTo('2026-10-18')
    const dates = (await db.occurrences.toArray()).map((o) => o.date).sort()
    expect(dates).toEqual(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
  })
})

describe('getDayView', () => {
  it('budúci deň je náhľad z pravidiel a nič neukladá', async () => {
    await db.activities.add(activity('beh', daily))
    expect(await titles('2026-10-20', '2026-10-18')).toEqual(['beh:open'])
    expect(await db.occurrences.count()).toBe(0)
  })

  it('zoradí nesplnené podľa času, hotové na koniec', async () => {
    await db.activities.bulkAdd([
      activity('vecer', daily, { timeOfDay: '20:00' }),
      activity('rano', daily, { timeOfDay: '07:00' }),
      activity('bez casu', daily),
    ])
    await materializeDay('2026-10-18')
    await setStatus('rano_2026-10-18', 'done')
    expect(await titles('2026-10-18', '2026-10-18')).toEqual(['vecer:open', 'bez casu:open', 'rano:done'])
  })
})

describe('úpravy', () => {
  it('zmena názvu nezmení históriu, dnešok sa prepočíta', async () => {
    const a = activity('beh', daily)
    await db.activities.add(a)
    await materializeDay('2026-10-17')
    await materializeDay('2026-10-18')
    await saveActivity({ ...a, title: 'Beh 5 km' }, '2026-10-18')
    expect(await titles('2026-10-17', '2026-10-18')).toEqual(['beh:open'])
    expect(await titles('2026-10-18', '2026-10-18')).toEqual(['Beh 5 km:open'])
  })

  it('zmazaná aktivita zmizne z dneška aj budúcich dní, v histórii ostane', async () => {
    await db.activities.add(activity('beh', daily))
    await materializeDay('2026-10-17')
    await setStatus('beh_2026-10-17', 'done')
    await materializeDay('2026-10-18')
    await deleteActivity('beh', '2026-10-18')
    expect(await titles('2026-10-17', '2026-10-18')).toEqual(['beh:done'])
    expect(await titles('2026-10-18', '2026-10-18')).toEqual([])
    expect(await titles('2026-10-19', '2026-10-18')).toEqual([])
  })

  it('ručný presun na zajtra', async () => {
    await addQuickTask('Zavolať', '2026-10-18', '2026-10-18')
    const [item] = await getDayView('2026-10-18', '2026-10-18')
    await moveOccurrence(item.occurrence!, '2026-10-19')
    expect(await titles('2026-10-18', '2026-10-18')).toEqual(['Zavolať:carried'])
    const tomorrow = await getDayView('2026-10-19', '2026-10-18')
    expect(tomorrow.map((i) => [i.title, i.status, i.carriedFrom])).toEqual([['Zavolať', 'open', '2026-10-18']])
  })
})
