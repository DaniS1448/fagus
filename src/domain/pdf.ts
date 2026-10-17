import { PDFDocument, rgb } from "pdf-lib"
import type { CropMark } from "./impose"
import { mmToPt } from "./units"

export type PdfImage = {
  png: Uint8Array
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export type PdfPage = {
  widthMm: number
  heightMm: number
  images: PdfImage[]
  cropMarks: CropMark[]
}

const MARK = rgb(143 / 255, 45 / 255, 45 / 255)

export async function buildPdf(pages: readonly PdfPage[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle("Fagus")
  pdf.setCreator("Fagus")

  for (const spec of pages) {
    const page = pdf.addPage([mmToPt(spec.widthMm), mmToPt(spec.heightMm)])
    for (const image of spec.images) {
      const embedded = await pdf.embedPng(image.png)
      const width = mmToPt(image.widthMm)
      const height = mmToPt(image.heightMm)
      page.drawImage(embedded, {
        x: mmToPt(image.xMm),
        y: mmToPt(spec.heightMm - image.yMm - image.heightMm),
        width,
        height,
      })
    }
    for (const mark of spec.cropMarks) {
      page.drawLine({
        start: { x: mmToPt(mark.x1), y: mmToPt(spec.heightMm - mark.y1) },
        end: { x: mmToPt(mark.x2), y: mmToPt(spec.heightMm - mark.y2) },
        thickness: 0.4,
        color: MARK,
      })
    }
  }

  return pdf.save()
}
