import { z } from "zod"
import { DEFAULT_HEIGHT_MM, DEFAULT_WIDTH_MM } from "./units"

export const bookmarkFontSchema = z.enum([
  "libre-baskerville",
  "source-sans-3",
  "barlow-condensed",
])

export const textStyleSchema = z.object({
  fontFamily: bookmarkFontSchema,
  fontSizeMm: z.number().positive().max(40),
  lineHeight: z.number().min(0.8).max(3),
  align: z.enum(["left", "center", "right"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  letterSpacingMm: z.number().min(-2).max(5),
})

export type TextStyle = z.infer<typeof textStyleSchema>

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

export const quoteElementSchema = z.object({
  type: z.literal("quote"),
  mode: z.enum(["fixed", "pool"]),
  quoteId: z.string().nullable(),
  poolIds: z.array(z.string()),
  style: textStyleSchema,
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
  ...frameFields,
})

export const identityElementSchema = z.object({
  type: z.literal("identity"),
  identityId: z.string().min(1),
  style: textStyleSchema,
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

export function textStyle(partial?: Partial<TextStyle>): TextStyle {
  return {
    fontFamily: "libre-baskerville",
    fontSizeMm: 4.2,
    lineHeight: 1.25,
    align: "center",
    color: "#1A1814",
    letterSpacingMm: 0,
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
  }
}

export const defaultPage = {
  widthMm: DEFAULT_WIDTH_MM,
  heightMm: DEFAULT_HEIGHT_MM,
}
