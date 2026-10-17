export const BULK_LIMIT = 200

export function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

export function filterByQuery<T>(items: readonly T[], query: string, haystack: (item: T) => string): T[] {
  const folded = fold(query.trim())
  if (folded.length === 0) return items.slice()
  return items.filter((item) => fold(haystack(item)).includes(folded))
}

export function listResetKey(filter: string, query: string): string {
  return `${filter}\0${query}`
}
