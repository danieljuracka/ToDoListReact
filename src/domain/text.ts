/** Text na porovnávanie: bez diakritiky, malými písmenami, bez okrajových medzier. */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
