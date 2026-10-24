import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Activity, RecurrenceRule } from '@/domain/types'
import { db } from './db'
import {
  addActivityToDay,
  createAndAddActivity,
  deleteActivity,
  getDayView,
  materializeDay,
  materializeUpTo,
  moveOccurrence,
  removeFromDay,
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
const onDemand = { type: 'onDemand' } as const
// 19. 10. 2026 je pondelok
const mondays: RecurrenceRule = { type: 'weekly', interval: 1, weekdays: [1] }
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
    await db.activities.bulkAdd([activity('nakup', onDemand, { carryOver: true }), activity('posta', onDemand)])
    await addActivityToDay('nakup', '2026-10-17', '2026-10-17')
    await addActivityToDay('posta', '2026-10-17', '2026-10-17')
    await materializeDay('2026-10-17')
    await materializeDay('2026-10-18')
    expect(await titles('2026-10-17', '2026-10-18')).toEqual(['nakup:carried', 'posta:open'])
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

  it('zoradí podľa času bez ohľadu na stav', async () => {
    await db.activities.bulkAdd([
      activity('vecer', daily, { timeOfDay: '20:00' }),
      activity('rano', daily, { timeOfDay: '07:00' }),
      activity('bez casu', daily),
    ])
    await materializeDay('2026-10-18')
    await setStatus('rano_2026-10-18', 'done')
    expect(await titles('2026-10-18', '2026-10-18')).toEqual(['rano:done', 'vecer:open', 'bez casu:open'])
  })

  it('priorita ovplyvní poradie iba zapnutá', async () => {
    await db.activities.bulkAdd([
      activity('a nizka', daily, { priority: 'low' }),
      activity('b vysoka', daily, { priority: 'high' }),
    ])
    expect(await titles('2026-10-20', '2026-10-18')).toEqual(['b vysoka:open', 'a nizka:open'])
    const plain = await getDayView('2026-10-20', '2026-10-18', false)
    expect(plain.map((i) => i.title)).toEqual(['a nizka', 'b vysoka'])
  })
})

describe('pridanie na deň', () => {
  it('uloží ručný výskyt v minulý, dnešný aj budúci deň', async () => {
    await db.activities.add(activity('nakup', onDemand))
    for (const date of ['2026-10-17', '2026-10-18', '2026-10-25']) {
      expect(await addActivityToDay('nakup', date, '2026-10-18')).toBe('added')
      expect((await db.occurrences.get(`nakup_${date}`))?.manual).toBe(true)
    }
    expect(await titles('2026-10-25', '2026-10-18')).toEqual(['nakup:open'])
  })

  it('druhé pridanie nevytvorí duplikát', async () => {
    await db.activities.add(activity('nakup', onDemand))
    await addActivityToDay('nakup', '2026-10-18', '2026-10-18')
    expect(await addActivityToDay('nakup', '2026-10-18', '2026-10-18')).toBe('alreadyPresent')
    expect(await db.occurrences.count()).toBe(1)
  })

  it('preskočenú misiu znova otvorí', async () => {
    await db.activities.add(activity('beh', daily))
    await materializeDay('2026-10-18')
    await setStatus('beh_2026-10-18', 'skipped')
    expect(await addActivityToDay('beh', '2026-10-18', '2026-10-18')).toBe('reopened')
    expect(await titles('2026-10-18', '2026-10-18')).toEqual(['beh:open'])
  })

  it('budúci deň z cyklu už misiu má', async () => {
    await db.activities.add(activity('beh', mondays))
    expect(await addActivityToDay('beh', '2026-10-26', '2026-10-18')).toBe('alreadyPresent')
    expect(await db.occurrences.count()).toBe(0)
  })

  it('aktivitu s cyklom pridá aj na deň mimo cyklu, cyklus ostane', async () => {
    await db.activities.add(activity('beh', mondays))
    expect(await addActivityToDay('beh', '2026-10-24', '2026-10-18')).toBe('added')
    expect(await titles('2026-10-24', '2026-10-18')).toEqual(['beh:open'])
    expect(await titles('2026-10-26', '2026-10-18')).toEqual(['beh:open'])
  })

  it('úprava aktivity nezmaže ručný výskyt, zmazanie áno', async () => {
    const a = activity('beh', mondays)
    await db.activities.add(a)
    await addActivityToDay('beh', '2026-10-24', '2026-10-18')
    await saveActivity({ ...a, title: 'Beh 5 km' }, '2026-10-18')
    expect(await titles('2026-10-24', '2026-10-18')).toEqual(['beh:open'])
    await deleteActivity('beh', '2026-10-18')
    expect(await titles('2026-10-24', '2026-10-18')).toEqual([])
  })

  it('vytvorí aktivitu podľa potreby a uloží výskyt aj na budúci deň', async () => {
    await createAndAddActivity('Zavolať', '2026-10-25', '2026-10-18')
    const [created] = await db.activities.toArray()
    expect(created.recurrence).toEqual(onDemand)
    expect(await titles('2026-10-25', '2026-10-18')).toEqual(['Zavolať:open'])
  })
})

describe('odobratie z dňa', () => {
  it('ručný výskyt mimo cyklu zmaže a skipDates nezmení', async () => {
    await db.activities.add(activity('nakup', onDemand))
    await addActivityToDay('nakup', '2026-10-18', '2026-10-18')
    await removeFromDay('nakup', '2026-10-18')
    expect(await titles('2026-10-18', '2026-10-18')).toEqual([])
    expect((await db.activities.get('nakup'))?.skipDates).toEqual([])
    expect(await addActivityToDay('nakup', '2026-10-18', '2026-10-18')).toBe('added')
  })

  it('výskyt z cyklu sa už nevytvorí znova, ostatné dni ostanú', async () => {
    await db.activities.add(activity('beh', daily))
    await materializeDay('2026-10-18')
    await removeFromDay('beh', '2026-10-18')
    await materializeDay('2026-10-18')
    expect(await titles('2026-10-18', '2026-10-18')).toEqual([])
    expect(await titles('2026-10-19', '2026-10-18')).toEqual(['beh:open'])
  })

  it('budúci náhľad z cyklu zmizne a dá sa znova pridať', async () => {
    await db.activities.add(activity('beh', mondays))
    await removeFromDay('beh', '2026-10-26')
    expect(await titles('2026-10-26', '2026-10-18')).toEqual([])
    expect(await titles('2026-11-02', '2026-10-18')).toEqual(['beh:open'])
    expect(await addActivityToDay('beh', '2026-10-26', '2026-10-18')).toBe('added')
  })

  it('splnenú misiu neodoberie', async () => {
    await db.activities.add(activity('beh', daily))
    await materializeDay('2026-10-18')
    await setStatus('beh_2026-10-18', 'done')
    await removeFromDay('beh', '2026-10-18')
    expect(await titles('2026-10-18', '2026-10-18')).toEqual(['beh:done'])
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
    await createAndAddActivity('Zavolať', '2026-10-18', '2026-10-18')
    const [item] = await getDayView('2026-10-18', '2026-10-18')
    await moveOccurrence(item.occurrence!, '2026-10-19')
    expect(await titles('2026-10-18', '2026-10-18')).toEqual(['Zavolať:carried'])
    const tomorrow = await getDayView('2026-10-19', '2026-10-18')
    expect(tomorrow.map((i) => [i.title, i.status, i.carriedFrom])).toEqual([['Zavolať', 'open', '2026-10-18']])
  })
})
