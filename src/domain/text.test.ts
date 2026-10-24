import { describe, expect, it } from 'vitest'
import { normalizeText } from './text'

describe('normalizeText', () => {
  it('ignoruje diakritiku, veľkosť písmen a okrajové medzery', () => {
    expect(normalizeText('  Kúpiť CHLIEB ')).toBe('kupit chlieb')
    expect(normalizeText('Ťažké úlohy')).toContain('tazk')
  })
})
