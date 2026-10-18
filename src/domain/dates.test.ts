import { describe, expect, it } from 'vitest'
import { addDaysISO, formatDayTitle, parseISODate, toISODate } from './dates'

describe('dates', () => {
  it('prevedie dátum tam a späť bez posunu dňa', () => {
    expect(toISODate(parseISODate('2026-03-29'))).toBe('2026-03-29')
  })

  it('pripočíta deň cez prechod na letný čas', () => {
    expect(addDaysISO('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDaysISO('2026-03-29', 1)).toBe('2026-03-30')
  })

  it('pripočíta deň cez koniec februára v priestupnom roku', () => {
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('naformátuje deň po slovensky', () => {
    expect(formatDayTitle('2026-10-18')).toBe('nedeľa 18. októbra')
  })
})
