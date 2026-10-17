import type { SideDocument } from "./document"

export type Project = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type Design = {
  id: string
  projectId: string
  name: string
  widthMm: number
  heightMm: number
  sides: "single" | "double"
  front: SideDocument
  back: SideDocument
  seed: number
  createdAt: number
  updatedAt: number
}

export type Photo = {
  id: string
  groupId: string | null
  name: string
  mime: string
  widthPx: number
  heightPx: number
  createdAt: number
}

export type PhotoGroup = {
  id: string
  name: string
  createdAt: number
}

export type ItemGroup = PhotoGroup

export type Quote = {
  id: string
  groupId: string | null
  body: string
  attribution: string
  createdAt: number
  updatedAt: number
}

export type BibleText = {
  id: string
  groupId: string | null
  book: string
  chapter: number
  verseStart: number
  verseEnd: number | null
  body: string
  translation: string
  createdAt: number
  updatedAt: number
}

export type IdentityKind = "wordmark" | "logo" | "lockup"
export type IdentityLayout = "stack" | "row"

export type Identity = {
  id: string
  groupId: string | null
  kind: IdentityKind
  layout: IdentityLayout | null
  name: string
  text: string
  mime: string | null
  widthPx: number | null
  heightPx: number | null
  createdAt: number
  updatedAt: number
}

export function identityHasImage(kind: IdentityKind): boolean {
  switch (kind) {
    case "logo":
    case "lockup":
      return true
    case "wordmark":
      return false
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

export function designPayload(design: Pick<
  Design,
  "name" | "widthMm" | "heightMm" | "sides" | "front" | "back" | "seed"
>) {
  return {
    name: design.name,
    widthMm: design.widthMm,
    heightMm: design.heightMm,
    sides: design.sides,
    front: design.front,
    back: design.back,
    seed: design.seed,
  }
}
