import type { SideDocument, TextStyle } from "./document"
import { formatReference } from "./reference"
import { mixSeed, pickIndex } from "./random"

export type QuoteRecord = {
  id: string
  body: string
  attribution: string
}

export type BibleRecord = {
  id: string
  book: string
  chapter: number
  verseStart: number
  verseEnd: number | null
  body: string
  translation: string
}

export type IdentityRecord = {
  id: string
  kind: "wordmark" | "logo"
  name: string
  text: string
  widthPx: number | null
  heightPx: number | null
}

export type PhotoRecord = {
  id: string
  widthPx: number
  heightPx: number
}

export type LibrarySnapshot = {
  quotes: readonly QuoteRecord[]
  bibleTexts: readonly BibleRecord[]
  identities: readonly IdentityRecord[]
  photos: readonly PhotoRecord[]
}

type Frame = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export type ResolvedPhoto = Frame & {
  type: "photo"
  photoId: string | null
  imageWidth: number
  imageHeight: number
  fit: "cover" | "contain"
  scale: number
  offsetX: number
  offsetY: number
  broken: boolean
}

export type ResolvedQuote = Frame & {
  type: "quote"
  text: string
  attribution: string
  style: TextStyle
  gapMm: number
  broken: boolean
  sourceId: string | null
}

export type ResolvedBible = Frame & {
  type: "bible"
  text: string
  reference: string
  showReference: boolean
  style: TextStyle
  referenceStyle: TextStyle
  gapMm: number
  broken: boolean
  sourceId: string | null
}

export type ResolvedIdentity = Frame & {
  type: "identity"
  kind: "wordmark" | "logo" | "missing"
  text: string
  imageId: string | null
  imageWidth: number
  imageHeight: number
  fit: "cover" | "contain"
  scale: number
  offsetX: number
  offsetY: number
  style: TextStyle
  broken: boolean
}

export type ResolvedElement = ResolvedPhoto | ResolvedQuote | ResolvedBible | ResolvedIdentity

export type ResolvedSide = {
  background: string
  elements: ResolvedElement[]
  broken: boolean
}

function pool<T extends { id: string }>(items: readonly T[], poolIds: readonly string[]): T[] {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id))
  if (poolIds.length === 0) return sorted
  const allowed = new Set(poolIds)
  return sorted.filter((item) => allowed.has(item.id))
}

function choose<T extends { id: string }>(items: readonly T[], seed: number): T | undefined {
  if (items.length === 0) return undefined
  return items[pickIndex(items.length, seed)]
}

export function resolveDocument(
  document: SideDocument,
  libraries: LibrarySnapshot,
  seed: number,
): ResolvedSide {
  const elements = document.elements.map((element, index) =>
    resolveElement(element, libraries, mixSeed(seed, index)),
  )
  return {
    background: document.background,
    elements,
    broken: elements.some((element) => element.broken),
  }
}

function frameOf(element: Frame): Frame {
  return {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
  }
}

function resolveElement(
  element: SideDocument["elements"][number],
  libraries: LibrarySnapshot,
  seed: number,
): ResolvedElement {
  switch (element.type) {
    case "photo": {
      const photo = libraries.photos.find((item) => item.id === element.photoId)
      return {
        ...frameOf(element),
        type: "photo",
        photoId: photo?.id ?? null,
        imageWidth: photo?.widthPx ?? 1,
        imageHeight: photo?.heightPx ?? 1,
        fit: element.fit,
        scale: element.scale,
        offsetX: element.offsetX,
        offsetY: element.offsetY,
        broken: !photo,
      }
    }
    case "quote": {
      const chosen =
        element.mode === "fixed"
          ? libraries.quotes.find((item) => item.id === element.quoteId)
          : choose(pool(libraries.quotes, element.poolIds), seed)
      return {
        ...frameOf(element),
        type: "quote",
        text: chosen?.body ?? "",
        attribution: chosen?.attribution ?? "",
        style: element.style,
        gapMm: element.gapMm,
        broken: !chosen,
        sourceId: chosen?.id ?? null,
      }
    }
    case "bible": {
      const chosen =
        element.mode === "fixed"
          ? libraries.bibleTexts.find((item) => item.id === element.bibleTextId)
          : choose(pool(libraries.bibleTexts, element.poolIds), seed)
      return {
        ...frameOf(element),
        type: "bible",
        text: chosen?.body ?? "",
        reference: chosen
          ? formatReference(chosen.book, chosen.chapter, chosen.verseStart, chosen.verseEnd)
          : "",
        showReference: element.showReference,
        style: element.style,
        referenceStyle: element.referenceStyle,
        gapMm: element.gapMm,
        broken: !chosen,
        sourceId: chosen?.id ?? null,
      }
    }
    case "identity":
      return resolveIdentity(element, libraries)
    default: {
      const unknown: never = element
      return unknown
    }
  }
}

function resolveIdentity(
  element: Extract<SideDocument["elements"][number], { type: "identity" }>,
  libraries: LibrarySnapshot,
): ResolvedIdentity {
  const identity = libraries.identities.find((item) => item.id === element.identityId)
  const shared = {
    ...frameOf(element),
    type: "identity" as const,
    fit: element.fit,
    scale: element.scale,
    offsetX: element.offsetX,
    offsetY: element.offsetY,
    style: element.style,
  }
  if (!identity) {
    return {
      ...shared,
      kind: "missing",
      text: "",
      imageId: null,
      imageWidth: 1,
      imageHeight: 1,
      broken: true,
    }
  }
  switch (identity.kind) {
    case "logo":
      return {
        ...shared,
        kind: "logo",
        text: identity.name,
        imageId: identity.id,
        imageWidth: identity.widthPx ?? 1,
        imageHeight: identity.heightPx ?? 1,
        broken: identity.widthPx == null || identity.heightPx == null,
      }
    case "wordmark":
      return {
        ...shared,
        kind: "wordmark",
        text: identity.text,
        imageId: null,
        imageWidth: 1,
        imageHeight: 1,
        broken: identity.text.trim().length === 0,
      }
    default: {
      const unknown: never = identity.kind
      return unknown
    }
  }
}
