import { format } from 'date-fns'
import { parseISODate } from './dates'
import type { RecurrenceRule, Weekday } from './types'

export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: 'Po', 2: 'Ut', 3: 'St', 4: 'Št', 5: 'Pi', 6: 'So', 7: 'Ne' }

const WEEKDAY_LONG: Record<Weekday, string> = {
  1: 'pondelok',
  2: 'utorok',
  3: 'streda',
  4: 'štvrtok',
  5: 'piatok',
  6: 'sobota',
  7: 'nedeľa',
}

const NTH: Record<number, string> = { 1: 'prvý', 2: 'druhý', 3: 'tretí', 4: 'štvrtý', [-1]: 'posledný' }

/** Popis pravidla pre zoznam aktivít, napr. „Každý Po, St, Pi“. */
export function describeRule(rule: RecurrenceRule): string {
  switch (rule.type) {
    case 'once':
      return `Jednorazovo ${format(parseISODate(rule.date), 'd. M. yyyy')}`
    case 'daily':
      return rule.interval === 1 ? 'Každý deň' : `Každých ${rule.interval} dní`
    case 'weekly': {
      const days = [...rule.weekdays].sort().map((d) => WEEKDAY_SHORT[d]).join(', ')
      return rule.interval === 1 ? `Každý ${days}` : `Každý ${rule.interval}. týždeň: ${days}`
    }
    case 'monthlyDay':
      return `Mesačne ${rule.day}.`
    case 'monthlyNthWeekday':
      return `Mesačne ${NTH[rule.nth]} ${WEEKDAY_LONG[rule.weekday]}`
    case 'yearly':
      return `Ročne ${rule.day}. ${rule.month}.`
    case 'workdays':
      return 'Pracovné dni'
    case 'weekends':
      return 'Víkendy'
    case 'timesPerWeek':
      return `${rule.count}× za týždeň`
  }
}
