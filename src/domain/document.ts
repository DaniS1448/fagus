import { z } from "zod"
import { DEFAULT_HEIGHT_MM, DEFAULT_WIDTH_MM } from "./units"

export const bookmarkFontSchema = z.enum([
  "libre-baskerville",
  "source-sans-3",
  "barlow-condensed",
])

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

function clamped(fallback: number, min: number, max: number) {
  return z.preprocess((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback
    return Math.min(max, Math.max(min, value))
  }, z.number())
}

const optionalHex = z.preprocess((value) => {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null
}, hexColor.nullable())

export const textStyleSchema = z.object({
  fontFamily: bookmarkFontSchema,
  fontSizeMm: z.number().positive().max(40),
  lineHeight: z.number().min(0.8).max(3),
  align: z.enum(["left", "center", "right"]),
  color: hexColor,
  letterSpacingMm: z.number().min(-2).max(5),
  strokeColor: optionalHex.default(null),
  strokeWidthMm: clamped(0, 0, 2),
})

export type TextStyle = z.infer<typeof textStyleSchema>

const plateObject = z.object({
  color: optionalHex.default(null),
  opacity: clamped(1, 0, 1),
  paddingTopMm: clamped(1.5, 0, 30),
  paddingRightMm: clamped(1.5, 0, 30),
  paddingBottomMm: clamped(1.5, 0, 30),
  paddingLeftMm: clamped(1.5, 0, 30),
  radiusMm: clamped(0, 0, 30),
})

const emptyPlateValue = {
  color: null,
  opacity: 1,
  paddingTopMm: 1.5,
  paddingRightMm: 1.5,
  paddingBottomMm: 1.5,
  paddingLeftMm: 1.5,
  radiusMm: 0,
}

export const plateSchema = z.preprocess((value) => {
  if (value == null || typeof value !== "object") return value
  const plate = value as Record<string, unknown>
  const shared = typeof plate.paddingMm === "number" ? plate.paddingMm : undefined
  if (shared == null) return plate
  return {
    ...plate,
    paddingTopMm: plate.paddingTopMm ?? shared,
    paddingRightMm: plate.paddingRightMm ?? shared,
    paddingBottomMm: plate.paddingBottomMm ?? shared,
    paddingLeftMm: plate.paddingLeftMm ?? shared,
  }
}, plateObject.default(emptyPlateValue))

export type Plate = z.infer<typeof plateSchema>

export function emptyPlate(): Plate {
  return { ...emptyPlateValue }
}

const frameFields = {
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number(),
}

const fitFields = {
  fit: z.enum(["cover", "contain"]),
  scale: z.number().positive().max(8),
  offsetX: z.number().min(-1).max(1),
  offsetY: z.number().min(-1).max(1),
}

export const photoElementSchema = z.object({
  type: z.literal("photo"),
  photoId: z.string().min(1),
  ...frameFields,
  ...fitFields,
})

const gapMmSchema = z.preprocess((value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 2
  return Math.min(30, Math.max(0, value))
}, z.number())

export const quoteElementSchema = z.object({
  type: z.literal("quote"),
  mode: z.enum(["fixed", "pool"]),
  quoteId: z.string().nullable(),
  poolIds: z.array(z.string()),
  style: textStyleSchema,
  gapMm: gapMmSchema,
  plate: plateSchema,
  ...frameFields,
})

export const bibleElementSchema = z.object({
  type: z.literal("bible"),
  mode: z.enum(["fixed", "pool"]),
  bibleTextId: z.string().nullable(),
  poolIds: z.array(z.string()),
  showReference: z.boolean(),
  style: textStyleSchema,
  referenceStyle: textStyleSchema,
  gapMm: gapMmSchema,
  plate: plateSchema,
  ...frameFields,
})

export const identityElementSchema = z.object({
  type: z.literal("identity"),
  identityId: z.string().min(1),
  style: textStyleSchema,
  plate: plateSchema,
  ...frameFields,
  ...fitFields,
})

export const elementSchema = z.discriminatedUnion("type", [
  photoElementSchema,
  quoteElementSchema,
  bibleElementSchema,
  identityElementSchema,
])

export const sideDocumentSchema = z.object({
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  elements: z.array(elementSchema),
})

export type PhotoElement = z.infer<typeof photoElementSchema>
export type QuoteElement = z.infer<typeof quoteElementSchema>
export type BibleElement = z.infer<typeof bibleElementSchema>
export type IdentityElement = z.infer<typeof identityElementSchema>
export type BookmarkElement = z.infer<typeof elementSchema>
export type SideDocument = z.infer<typeof sideDocumentSchema>
export type ElementType = BookmarkElement["type"]

export const PAPER_COLOR = "#F4F0E6"

export function emptySide(): SideDocument {
  return { background: PAPER_COLOR, elements: [] }
}

export function parseSideDocument(value: unknown): SideDocument {
  const parsed = sideDocumentSchema.safeParse(value)
  if (parsed.success) return parsed.data
  return emptySide()
}

export function parsedDesign<T extends { front: unknown; back: unknown }>(design: T): T & { front: SideDocument; back: SideDocument } {
  return {
    ...design,
    front: parseSideDocument(design.front),
    back: parseSideDocument(design.back),
  }
}

export function textStyle(partial?: Partial<TextStyle>): TextStyle {
  return {
    fontFamily: "libre-baskerville",
    fontSizeMm: 4.2,
    lineHeight: 1.25,
    align: "center",
    color: "#1A1814",
    letterSpacingMm: 0,
    strokeColor: null,
    strokeWidthMm: 0,
    ...partial,
  }
}

export function createPhotoElement(photoId: string, pageWidth: number, pageHeight: number): PhotoElement {
  return {
    id: crypto.randomUUID(),
    type: "photo",
    photoId,
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    rotation: 0,
    fit: "cover",
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }
}

export function createQuoteElement(pageWidth: number, pageHeight: number): QuoteElement {
  const width = Math.max(12, pageWidth - 8)
  const height = Math.min(48, Math.max(24, pageHeight * 0.28))
  return {
    id: crypto.randomUUID(),
    type: "quote",
    mode: "pool",
    quoteId: null,
    poolIds: [],
    x: (pageWidth - width) / 2,
    y: pageHeight - height - 16,
    width,
    height,
    rotation: 0,
    style: textStyle(),
    gapMm: 2,
    plate: emptyPlate(),
  }
}

export function createBibleElement(pageWidth: number, pageHeight: number): BibleElement {
  const width = Math.max(12, pageWidth - 8)
  const height = Math.min(42, Math.max(22, pageHeight * 0.24))
  return {
    id: crypto.randomUUID(),
    type: "bible",
    mode: "pool",
    bibleTextId: null,
    poolIds: [],
    showReference: true,
    x: (pageWidth - width) / 2,
    y: Math.max(8, (pageHeight - height) / 2),
    width,
    height,
    rotation: 0,
    style: textStyle({ fontSizeMm: 3.6 }),
    referenceStyle: textStyle({
      fontFamily: "source-sans-3",
      fontSizeMm: 2.6,
    }),
    gapMm: 2,
    plate: emptyPlate(),
  }
}

export function createIdentityElement(
  identityId: string,
  kind: "wordmark" | "logo",
  pageWidth: number,
  pageHeight: number,
): IdentityElement {
  if (kind === "logo") {
    const size = Math.min(16, pageWidth - 8)
    return {
      id: crypto.randomUUID(),
      type: "identity",
      identityId,
      x: (pageWidth - size) / 2,
      y: 6,
      width: size,
      height: size,
      rotation: 0,
      fit: "contain",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      style: textStyle({ fontFamily: "barlow-condensed", fontSizeMm: 3.2 }),
      plate: emptyPlate(),
    }
  }

  const width = Math.max(12, pageWidth - 8)
  const height = 14
  return {
    id: crypto.randomUUID(),
    type: "identity",
    identityId,
    x: (pageWidth - width) / 2,
    y: pageHeight - height - 4,
    width,
    height,
    rotation: 0,
    fit: "contain",
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    style: textStyle({
      fontFamily: "barlow-condensed",
      fontSizeMm: 3.2,
      letterSpacingMm: 0.15,
      color: "#1A1814",
    }),
    plate: emptyPlate(),
  }
}

export const defaultPage = {
  widthMm: DEFAULT_WIDTH_MM,
  heightMm: DEFAULT_HEIGHT_MM,
}
