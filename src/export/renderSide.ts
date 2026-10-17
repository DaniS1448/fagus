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
  const canvas = stage.toCanvas({ pixelRatio: 1 })
  stage.destroy()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("No se pudo crear el PNG"))), "image/png")
  })
  return new Uint8Array(await blob.arrayBuffer())
}

export async function sheetsToPdf(sheets: readonly PlannedSheet[], images: ReadonlyMap<string, HTMLImageElement>, dpi: number): Promise<Uint8Array> {
  const cache = new Map<string, Uint8Array>()
  const pages: PdfPage[] = []
  for (const sheet of sheets) {
    const placed = []
    for (const cell of sheet.cells) {
      const key = JSON.stringify({
        id: cell.design.id,
        side: sheet.side,
        copy: cell.copyIndex,
        seed: cell.design.seed,
        front: cell.design.front,
        back: cell.design.back,
        dpi,
      })
      let png = cache.get(key)
      if (!png) {
        png = await renderSidePng({
          side: cell.resolved,
          widthMm: cell.widthMm,
          heightMm: cell.heightMm,
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
