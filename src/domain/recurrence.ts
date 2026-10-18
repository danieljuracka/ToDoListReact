import {
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  getDate,
  getDaysInMonth,
  getISODay,
  getMonth,
} from 'date-fns'
import { addDaysISO, parseISODate } from './dates'
import type { Activity, ISODate, RecurrenceRule } from './types'

/**
 * Zistí, či pravidlo pripadá na daný deň. Deň v mesiaci, ktorý v kratšom mesiaci
 * neexistuje (31., 29. február), sa posunie na posledný deň mesiaca.
 */
export function matchesRule(rule: RecurrenceRule, start: Date, date: Date): boolean {
  switch (rule.type) {
    case 'once':
      return differenceInCalendarDays(date, parseISODate(rule.date)) === 0
    case 'daily':
      return differenceInCalendarDays(date, start) % Math.max(1, rule.interval) === 0
    case 'weekly': {
      const weeks = differenceInCalendarWeeks(date, start, { weekStartsOn: 1 })
      return weeks % Math.max(1, rule.interval) === 0 && rule.weekdays.includes(isoDay(date))
    }
    case 'monthlyDay':
      return getDate(date) === Math.min(rule.day, getDaysInMonth(date))
    case 'monthlyNthWeekday': {
      if (isoDay(date) !== rule.weekday) return false
      const day = getDate(date)
      if (rule.nth === -1) return day + 7 > getDaysInMonth(date)
      return Math.ceil(day / 7) === rule.nth
    }
    case 'yearly':
      return getMonth(date) + 1 === rule.month && getDate(date) === Math.min(rule.day, getDaysInMonth(date))
    case 'workdays':
      return isoDay(date) <= 5
    case 'weekends':
      return isoDay(date) >= 6
    case 'timesPerWeek':
      // Kandidát je každý deň; kvótu za týždeň stráži služba dní, lebo potrebuje históriu.
      return true
  }
}

/** Zistí, či má aktivita v daný deň výskyt (bez ohľadu na archiváciu a kvótu za týždeň). */
export function occursOn(activity: Activity, date: ISODate): boolean {
  if (date < activity.startDate) return false
  if (activity.endDate && date > activity.endDate) return false
  if (activity.skipDates.includes(date)) return false
  return matchesRule(activity.recurrence, parseISODate(activity.startDate), parseISODate(date))
}

/** Najbližších `count` výskytov od `from` vrátane, hľadá najviac 2 roky dopredu. */
export function nextOccurrences(activity: Activity, from: ISODate, count: number): ISODate[] {
  const result: ISODate[] = []
  let date = from < activity.startDate ? activity.startDate : from
  for (let i = 0; i < 730 && result.length < count; i++) {
    if (activity.endDate && date > activity.endDate) break
    if (occursOn(activity, date)) result.push(date)
    date = addDaysISO(date, 1)
  }
  return result
}

function isoDay(date: Date) {
  return getISODay(date) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}
