// Dátový model podľa zadania (sekcia „Pojmy a dátový model“).

/** Lokálny kalendárny deň vo formáte YYYY-MM-DD. */
export type ISODate = string

/** 1 = pondelok … 7 = nedeľa (ISO 8601). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type Priority = 'low' | 'medium' | 'high'

export type RecurrenceRule =
  | { type: 'once'; date: ISODate }
  | { type: 'daily'; interval: number }
  | { type: 'weekly'; interval: number; weekdays: Weekday[] }
  | { type: 'monthlyDay'; day: number }
  | { type: 'monthlyNthWeekday'; nth: 1 | 2 | 3 | 4 | -1; weekday: Weekday }
  | { type: 'yearly'; month: number; day: number }
  | { type: 'workdays' }
  | { type: 'weekends' }
  | { type: 'timesPerWeek'; count: number }

/** Šablóna úlohy – čo a ako často. */
export interface Activity {
  id: string
  title: string
  description?: string
  categoryId?: string
  priority: Priority
  color?: string
  durationMin?: number
  /** Čas dňa vo formáte HH:mm. */
  timeOfDay?: string
  recurrence: RecurrenceRule
  startDate: ISODate
  endDate?: ISODate
  /** Dátumy, v ktoré sa výskyt preskočí. */
  skipDates: ISODate[]
  /** Preniesť nesplnenú úlohu na ďalší deň. */
  carryOver: boolean
  createdAt: number
}

export type OccurrenceStatus = 'open' | 'done' | 'skipped' | 'carried'

/** Aktivita v konkrétny deň – to, čo sa ukladá do histórie. */
export interface Occurrence {
  id: string
  date: ISODate
  activityId: string
  /** Kópia názvu v čase vzniku, aby zmena aktivity nezmenila históriu. */
  titleSnapshot: string
  status: OccurrenceStatus
  completedAt?: number
  note?: string
  order: number
  /** Deň, z ktorého bola úloha prenesená. */
  carriedFrom?: ISODate
}

export interface Category {
  id: string
  name: string
  color: string
  order: number
}

export interface DayNote {
  date: ISODate
  note: string
}

export interface Settings {
  key: 'app'
  theme: 'system' | 'light' | 'dark'
  /** Predvolená hodnota carryOver pre nové aktivity. */
  defaultCarryOver: boolean
  /** Posledný deň, pre ktorý sú výskyty uložené v histórii. */
  lastMaterialized?: ISODate
}
