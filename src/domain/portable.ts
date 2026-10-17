import type { SideDocument } from "./document"

export type IdMaps = {
  quotes: ReadonlyMap<string, string>
  bibleTexts: ReadonlyMap<string, string>
  identities: ReadonlyMap<string, string>
  photos: ReadonlyMap<string, string>
}

type QuoteRef = { id: string }
type BibleRef = { id: string }
type PhotoRef = { id: string; groupId: string | null }

export type ExportSelection = {
  quoteIds: string[]
  bibleTextIds: string[]
  identityIds: string[]
  photoIds: string[]
  groupIds: string[]
}

export function selectionForDesigns(
  sides: readonly SideDocument[],
  libraries: { quotes: readonly QuoteRef[]; bibleTexts: readonly BibleRef[]; photos: readonly PhotoRef[] },
): ExportSelection {
  const quoteIds = new Set<string>()
  const bibleTextIds = new Set<string>()
  const identityIds = new Set<string>()
  const photoIds = new Set<string>()
  let allQuotes = false
  let allBible = false

  for (const side of sides) {
    for (const element of side.elements) {
      switch (element.type) {
        case "photo":
          photoIds.add(element.photoId)
          break
        case "identity":
          identityIds.add(element.identityId)
          break
        case "quote":
          if (element.mode === "fixed") {
            if (element.quoteId) quoteIds.add(element.quoteId)
          } else if (element.poolIds.length === 0) {
            allQuotes = true
          } else {
            for (const id of element.poolIds) quoteIds.add(id)
          }
          break
        case "bible":
          if (element.mode === "fixed") {
            if (element.bibleTextId) bibleTextIds.add(element.bibleTextId)
          } else if (element.poolIds.length === 0) {
            allBible = true
          } else {
            for (const id of element.poolIds) bibleTextIds.add(id)
          }
          break
        default: {
          const unknown: never = element
          return unknown
        }
      }
    }
  }

  const selectedPhotos = libraries.photos.filter((photo) => photoIds.has(photo.id))
  const groupIds = new Set<string>()
  for (const photo of selectedPhotos) {
    if (photo.groupId) groupIds.add(photo.groupId)
  }

  return {
    quoteIds: allQuotes ? libraries.quotes.map((item) => item.id) : [...quoteIds],
    bibleTextIds: allBible ? libraries.bibleTexts.map((item) => item.id) : [...bibleTextIds],
    identityIds: [...identityIds],
    photoIds: [...photoIds],
    groupIds: [...groupIds],
  }
}

export function remapSide(side: SideDocument, ids: IdMaps): SideDocument {
  return {
    background: side.background,
    elements: side.elements.map((element) => remapElement(element, ids)),
  }
}

function remapElement(element: SideDocument["elements"][number], ids: IdMaps): SideDocument["elements"][number] {
  switch (element.type) {
    case "photo":
      return { ...element, photoId: mapped(ids.photos, element.photoId) }
    case "quote":
      return {
        ...element,
        quoteId: element.quoteId ? mapped(ids.quotes, element.quoteId) : null,
        poolIds: element.poolIds.map((id) => mapped(ids.quotes, id)),
      }
    case "bible":
      return {
        ...element,
        bibleTextId: element.bibleTextId ? mapped(ids.bibleTexts, element.bibleTextId) : null,
        poolIds: element.poolIds.map((id) => mapped(ids.bibleTexts, id)),
      }
    case "identity":
      return { ...element, identityId: mapped(ids.identities, element.identityId) }
    default: {
      const unknown: never = element
      return unknown
    }
  }
}

function mapped(map: ReadonlyMap<string, string>, id: string): string {
  return map.get(id) ?? id
}
