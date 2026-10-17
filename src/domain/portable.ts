import type { SideDocument } from "./document"

export type IdMaps = {
  quotes: ReadonlyMap<string, string>
  bibleTexts: ReadonlyMap<string, string>
  identities: ReadonlyMap<string, string>
  photos: ReadonlyMap<string, string>
}

type QuoteRef = { id: string; groupId?: string | null }
type BibleRef = { id: string; groupId?: string | null }
type IdentityRef = { id: string; groupId?: string | null }
type PhotoRef = { id: string; groupId: string | null }

export type ExportSelection = {
  quoteIds: string[]
  bibleTextIds: string[]
  identityIds: string[]
  photoIds: string[]
  groupIds: string[]
  quoteGroupIds: string[]
  bibleGroupIds: string[]
  identityGroupIds: string[]
}

export type LibraryScope = "all" | "quotes" | "bible" | "identities" | "photos"

const FILE_STEMS: Record<LibraryScope, string> = {
  all: "bibliotecas",
  quotes: "citas",
  bible: "textos",
  identities: "identidad",
  photos: "fotos",
}

export function libraryFilename(scope: LibraryScope, groupName?: string): string {
  const stem = FILE_STEMS[scope]
  if (!groupName) return `${stem}.fagus`
  return `${stem}-${fileSlug(groupName)}.fagus`
}

function fileSlug(name: string): string {
  const value = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return value || "agrupacion"
}

export function includedLibraries(scope: LibraryScope): {
  quotes: boolean
  bible: boolean
  identities: boolean
  photos: boolean
} {
  switch (scope) {
    case "all":
      return { quotes: true, bible: true, identities: true, photos: true }
    case "quotes":
      return { quotes: true, bible: false, identities: false, photos: false }
    case "bible":
      return { quotes: false, bible: true, identities: false, photos: false }
    case "identities":
      return { quotes: false, bible: false, identities: true, photos: false }
    case "photos":
      return { quotes: false, bible: false, identities: false, photos: true }
    default: {
      const unknown: never = scope
      return unknown
    }
  }
}

export function remapGroupId(groupId: string | null, groups: ReadonlyMap<string, string>): string | null {
  if (groupId == null) return null
  return groups.get(groupId) ?? null
}

export function selectionForDesigns(
  sides: readonly SideDocument[],
  libraries: {
    quotes: readonly QuoteRef[]
    bibleTexts: readonly BibleRef[]
    identities?: readonly IdentityRef[]
    photos: readonly PhotoRef[]
  },
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

  const chosenQuoteIds = allQuotes ? libraries.quotes.map((item) => item.id) : [...quoteIds]
  const chosenBibleIds = allBible ? libraries.bibleTexts.map((item) => item.id) : [...bibleTextIds]
  const chosenIdentityIds = [...identityIds]
  const chosenPhotoIds = [...photoIds]

  return {
    quoteIds: chosenQuoteIds,
    bibleTextIds: chosenBibleIds,
    identityIds: chosenIdentityIds,
    photoIds: chosenPhotoIds,
    groupIds: groupsUsed(chosenPhotoIds, libraries.photos),
    quoteGroupIds: groupsUsed(chosenQuoteIds, libraries.quotes),
    bibleGroupIds: groupsUsed(chosenBibleIds, libraries.bibleTexts),
    identityGroupIds: groupsUsed(chosenIdentityIds, libraries.identities ?? []),
  }
}

function groupsUsed(ids: readonly string[], items: readonly { id: string; groupId?: string | null }[]): string[] {
  const wanted = new Set(ids)
  const groups = new Set<string>()
  for (const item of items) {
    if (wanted.has(item.id) && item.groupId) groups.add(item.groupId)
  }
  return [...groups]
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
