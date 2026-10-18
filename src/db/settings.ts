import type { Settings } from '@/domain/types'
import { db } from './db'

const DEFAULTS: Settings = { key: 'app', theme: 'system', defaultCarryOver: true }

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULTS, ...(await db.settings.get('app')) }
}

export async function updateSettings(changes: Partial<Omit<Settings, 'key'>>): Promise<void> {
  await db.settings.put({ ...(await getSettings()), ...changes })
}
