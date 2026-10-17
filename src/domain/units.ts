export const MM_PER_INCH = 25.4
export const PDF_PT_PER_MM = 72 / MM_PER_INCH
export const DEFAULT_WIDTH_MM = 50
export const DEFAULT_HEIGHT_MM = 155
export const DEFAULT_BLEED_GUIDE_MM = 3

export const PAPER_MM = {
  A4: { widthMm: 210, heightMm: 297 },
  A3: { widthMm: 297, heightMm: 420 },
} as const

export type PaperName = keyof typeof PAPER_MM
export type Orientation = "portrait" | "landscape"

export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi
}

export function mmToPt(mm: number): number {
  return mm * PDF_PT_PER_MM
}

export function paperSize(
  paper: PaperName,
  orientation: Orientation,
): { widthMm: number; heightMm: number } {
  const base = PAPER_MM[paper]
  if (orientation === "portrait") return { widthMm: base.widthMm, heightMm: base.heightMm }
  return { widthMm: base.heightMm, heightMm: base.widthMm }
}
