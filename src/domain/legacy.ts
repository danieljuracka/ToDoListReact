import type { Activity, ISODate, Occurrence, RecurrenceRule } from './types'

/** Pravidlo z verzií pred typom „Podľa potreby“. */
interface LegacyOnceRule {
  type: 'once'
  date: ISODate
}

export type StoredActivity = Omit<Activity, 'recurrence'> & { recurrence: RecurrenceRule | LegacyOnceRule }

/**
 * Prevedie jednorazovú aktivitu na „Podľa potreby“. Ak jej dátum je dnes alebo
 * neskôr, vráti aj výskyt, aby naplánovaná misia nezmizla. Minulé dni sú už v histórii.
 */
export function migrateOnceActivity(
  stored: StoredActivity,
  today: ISODate,
): { activity: Activity; occurrence?: Omit<Occurrence, 'order'> } {
  const rule = stored.recurrence
  if (rule.type !== 'once') return { activity: stored as Activity }
  const activity: Activity = { ...stored, recurrence: { type: 'onDemand' } }
  if (rule.date < today) return { activity }
  return {
    activity,
    occurrence: {
      id: `${activity.id}_${rule.date}`,
      date: rule.date,
      activityId: activity.id,
      titleSnapshot: activity.title,
      status: 'open',
      manual: true,
    },
  }
}
