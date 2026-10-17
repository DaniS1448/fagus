import type { Design } from "../domain/models"
import { emptySide } from "../domain/document"
import type { CropMark, ImposeOptions } from "../domain/impose"
import { impose } from "../domain/impose"
import { mixSeed } from "../domain/random"
import { resolveDocument, type LibrarySnapshot, type ResolvedSide } from "../domain/resolve"

export type PlannedCell = {
  design: Design
  copyIndex: number
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  resolved: ResolvedSide
}

export type PlannedSheet = {
  widthMm: number
  heightMm: number
  side: "front" | "back"
  sizeLabel: string
  cells: PlannedCell[]
  cropMarks: CropMark[]
}

type Job = { design: Design; copies: number }

export function planSheets(
  jobs: readonly Job[],
  libraries: LibrarySnapshot,
  options: Omit<ImposeOptions, "bookmarkWidthMm" | "bookmarkHeightMm">,
): { sheets: PlannedSheet[]; notes: string[] } {
  const notes: string[] = []
  const groups = new Map<string, Array<{ design: Design; copyIndex: number }>>()
  for (const job of jobs) {
    if (job.copies <= 0) continue
    const key = `${formatSize(job.design.widthMm)} × ${formatSize(job.design.heightMm)} mm`
    const list = groups.get(key) ?? []
    for (let copyIndex = 0; copyIndex < job.copies; copyIndex += 1) {
      list.push({ design: job.design, copyIndex })
    }
    groups.set(key, list)
  }

  const sheets: PlannedSheet[] = []
  for (const [sizeLabel, items] of groups) {
    const sample = items[0]?.design
    if (!sample) continue
    const imposed = impose(
      items.map((item) => ({ id: item.design.id, copyIndex: item.copyIndex })),
      {
        ...options,
        bookmarkWidthMm: sample.widthMm,
        bookmarkHeightMm: sample.heightMm,
      },
    )
    if (!imposed.fits) {
      notes.push(`El tamaño ${sizeLabel} no cabe en el pliego con ese margen.`)
      continue
    }
    for (const sheet of imposed.sheets) {
      sheets.push(buildSheet(sheet, "front", sizeLabel, items, libraries, sheet.front, sheet.frontCropMarks))
      if (options.duplex) {
        sheets.push(buildSheet(sheet, "back", sizeLabel, items, libraries, sheet.back, sheet.backCropMarks))
      }
    }
  }
  return { sheets, notes }
}

function buildSheet(
  sheet: { widthMm: number; heightMm: number },
  side: "front" | "back",
  sizeLabel: string,
  items: Array<{ design: Design; copyIndex: number }>,
  libraries: LibrarySnapshot,
  placements: Array<{ id: string; copyIndex: number; xMm: number; yMm: number; widthMm: number; heightMm: number }>,
  cropMarks: CropMark[],
): PlannedSheet {
  return {
    widthMm: sheet.widthMm,
    heightMm: sheet.heightMm,
    side,
    sizeLabel,
    cropMarks,
    cells: placements.flatMap((placement) => {
      const item = items.find((entry) => entry.design.id === placement.id && entry.copyIndex === placement.copyIndex)
      if (!item) return []
      const document =
        side === "back" && item.design.sides === "single"
          ? emptySide()
          : side === "front"
            ? item.design.front
            : item.design.back
      return [
        {
          design: item.design,
          copyIndex: item.copyIndex,
          xMm: placement.xMm,
          yMm: placement.yMm,
          widthMm: placement.widthMm,
          heightMm: placement.heightMm,
          resolved: resolveDocument(document, libraries, mixSeed(item.design.seed, item.copyIndex)),
        },
      ]
    }),
  }
}

function formatSize(value: number): string {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(value)
}
