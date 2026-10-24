import { describe, expect, it } from 'vitest'
import { nextOccurrences, occursOn } from './recurrence'
import type { Activity, RecurrenceRule } from './types'

function activity(recurrence: RecurrenceRule, extra: Partial<Activity> = {}): Activity {
  return {
    id: 'a',
    title: 'Test',
    priority: 'medium',
    recurrence,
    startDate: '2026-01-01',
    skipDates: [],
    carryOver: false,
    createdAt: 0,
    ...extra,
  }
}

const days = (a: Activity, from: string, count: number) => nextOccurrences(a, from, count)

describe('occursOn', () => {
  it('aktivita podľa potreby sa sama nezobrazí v žiadny deň', () => {
    const a = activity({ type: 'onDemand' }, { startDate: '2026-10-18' })
    expect(occursOn(a, '2026-10-18')).toBe(false)
    expect(days(a, '2026-10-18', 5)).toEqual([])
  })

  it('denne s intervalom 2 sa zobrazí každý druhý deň od startDate', () => {
    const a = activity({ type: 'daily', interval: 2 }, { startDate: '2026-03-27' })
    expect(days(a, '2026-03-27', 3)).toEqual(['2026-03-27', '2026-03-29', '2026-03-31'])
  })

  it('týždenne Po, St, Pi sa zobrazí presne v tieto dni', () => {
    const a = activity({ type: 'weekly', interval: 1, weekdays: [1, 3, 5] })
    // 19. 10. 2026 je pondelok
    expect(days(a, '2026-10-19', 4)).toEqual(['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26'])
  })

  it('každý 2. týždeň sa počíta od týždňa začiatku', () => {
    const a = activity({ type: 'weekly', interval: 2, weekdays: [1] }, { startDate: '2026-10-21' })
    expect(days(a, '2026-10-19', 3)).toEqual(['2026-11-02', '2026-11-16', '2026-11-30'])
  })

  it('mesačne 31. sa v kratšom mesiaci posunie na posledný deň', () => {
    const a = activity({ type: 'monthlyDay', day: 31 })
    expect(days(a, '2026-01-01', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('mesačne posledný piatok nájde správny deň', () => {
    const a = activity({ type: 'monthlyNthWeekday', nth: -1, weekday: 5 })
    expect(days(a, '2026-10-01', 2)).toEqual(['2026-10-30', '2026-11-27'])
  })

  it('mesačne druhý utorok', () => {
    const a = activity({ type: 'monthlyNthWeekday', nth: 2, weekday: 2 })
    expect(days(a, '2026-10-01', 1)).toEqual(['2026-10-13'])
  })

  it('ročne 29. februára sa v nepriestupnom roku posunie na 28.', () => {
    const a = activity({ type: 'yearly', month: 2, day: 29 })
    expect(days(a, '2027-01-01', 2)).toEqual(['2027-02-28', '2028-02-29'])
  })

  it('pracovné dni a víkendy', () => {
    const work = activity({ type: 'workdays' })
    const weekend = activity({ type: 'weekends' })
    expect(occursOn(work, '2026-10-16')).toBe(true) // piatok
    expect(occursOn(work, '2026-10-17')).toBe(false) // sobota
    expect(occursOn(weekend, '2026-10-18')).toBe(true) // nedeľa
    expect(occursOn(weekend, '2026-10-19')).toBe(false) // pondelok
  })

  it('nezobrazí sa pred startDate ani po endDate', () => {
    const a = activity({ type: 'daily', interval: 1 }, { startDate: '2026-10-10', endDate: '2026-10-12' })
    expect(occursOn(a, '2026-10-09')).toBe(false)
    expect(occursOn(a, '2026-10-12')).toBe(true)
    expect(occursOn(a, '2026-10-13')).toBe(false)
  })

  it('nezobrazí sa v dátume zo skipDates', () => {
    const a = activity({ type: 'daily', interval: 1 }, { skipDates: ['2026-10-18'] })
    expect(occursOn(a, '2026-10-18')).toBe(false)
    expect(occursOn(a, '2026-10-19')).toBe(true)
  })
})
