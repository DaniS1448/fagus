import Konva from "konva"
import { buildPdf, type PdfPage } from "../domain/pdf"
import type { PlannedSheet } from "./planSheets"
import { paintContent } from "../editor/paintSide"

export async function renderSidePng(input: {
  side: PlannedSheet["cells"][number]["resolved"]
  widthMm: number
  heightMm: number
  dpi: number
  images: ReadonlyMap<string, HTMLImageElement>
  rotation?: 0 | 90
}): Promise<Uint8Array> {
  await document.fonts.ready
  const pxPerMm = input.dpi / 25.4
  const width = Math.max(1, Math.round(input.widthMm * pxPerMm))
  const height = Math.max(1, Math.round(input.heightMm * pxPerMm))
  const container = document.createElement("div")
  const stage = new Konva.Stage({ container, width, height })
  const layer = new Konva.Layer()
  stage.add(layer)
  paintContent(layer, {
    side: input.side,
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    pxPerMm,
    images: input.images,
    guides: false,
  })
  layer.draw()
  const painted = stage.toCanvas({ pixelRatio: 1 })
  stage.destroy()
  const canvas = input.rotation === 90 ? turnClockwise(painted) : painted
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("No se pudo crear el PNG"))), "image/png")
  })
  return new Uint8Array(await blob.arrayBuffer())
}

function turnClockwise(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = source.height
  canvas.height = source.width
  const context = canvas.getContext("2d")
  if (!context) return source
  context.translate(canvas.width, 0)
  context.rotate(Math.PI / 2)
  context.drawImage(source, 0, 0)
  return canvas
}

export async function sheetsToPdf(sheets: readonly PlannedSheet[], images: ReadonlyMap<string, HTMLImageElement>, dpi: number): Promise<Uint8Array> {
  const cache = new Map<string, Uint8Array>()
  const pages: PdfPage[] = []
  for (const sheet of sheets) {
    const placed = []
    for (const cell of sheet.cells) {
      const content = contentSize(cell)
      const key = JSON.stringify({
        id: cell.design.id,
        side: sheet.side,
        copy: cell.copyIndex,
        seed: cell.design.seed,
        front: cell.design.front,
        back: cell.design.back,
        rotation: cell.rotation,
        dpi,
      })
      let png = cache.get(key)
      if (!png) {
        png = await renderSidePng({
          side: cell.resolved,
          widthMm: content.widthMm,
          heightMm: content.heightMm,
          rotation: cell.rotation,
          dpi,
          images,
        })
        cache.set(key, png)
      }
      placed.push({
        png,
        xMm: cell.xMm,
        yMm: cell.yMm,
        widthMm: cell.widthMm,
        heightMm: cell.heightMm,
      })
    }
    pages.push({
      widthMm: sheet.widthMm,
      heightMm: sheet.heightMm,
      images: placed,
      cropMarks: sheet.cropMarks,
    })
  }
  return buildPdf(pages)
}

export function contentSize(cell: PlannedSheet["cells"][number]): { widthMm: number; heightMm: number } {
  switch (cell.rotation) {
    case 0:
      return { widthMm: cell.widthMm, heightMm: cell.heightMm }
    case 90:
      return { widthMm: cell.heightMm, heightMm: cell.widthMm }
    default: {
      const unknown: never = cell.rotation
      return unknown
    }
  }
}
