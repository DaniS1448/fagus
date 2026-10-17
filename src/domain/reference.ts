export function formatReference(
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | null,
): string {
  if (verseEnd != null && verseEnd !== verseStart) {
    return `${book} ${chapter}:${verseStart}-${verseEnd}`
  }
  return `${book} ${chapter}:${verseStart}`
}
