import { addDays, format, parse } from 'date-fns'
import { sk } from 'date-fns/locale'
import type { ISODate } from './types'

const ISO_FORMAT = 'yyyy-MM-dd'

export function toISODate(date: Date): ISODate {
  return format(date, ISO_FORMAT)
}

/** Vráti lokálnu polnoc daného dňa (nie UTC), aby letný čas neposunul dátum. */
export function parseISODate(value: ISODate): Date {
  return parse(value, ISO_FORMAT, new Date())
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function addDaysISO(value: ISODate, days: number): ISODate {
  return toISODate(addDays(parseISODate(value), days))
}

/** Napr. „sobota 18. októbra“. */
export function formatDayTitle(value: ISODate): string {
  return format(parseISODate(value), 'EEEE d. MMMM', { locale: sk })
}
