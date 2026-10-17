import Konva from "konva"
import type { TextStyle } from "../domain/document"
import { fontLabel } from "../domain/fonts"

export type TextShadowImage = {
  canvas: HTMLCanvasElement
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export function textShadowImage(
  value: string,
  style: TextStyle,
  width: number,
  pxPerMm: number,
): TextShadowImage | null {
  if (!value.trim() || !style.shadowColor || style.shadowOpacity <= 0 || width <= 0) return null
  const ratio = Konva.pixelRatio || 1
  const left = shadowPixels(style.shadowLeftMm, pxPerMm, ratio)
  const right = shadowPixels(style.shadowRightMm, pxPerMm, ratio)
  const top = shadowPixels(style.shadowTopMm, pxPerMm, ratio)
  const bottom = shadowPixels(style.shadowBottomMm, pxPerMm, ratio)
  const blur = shadowPixels(style.shadowBlurMm, pxPerMm, ratio)
  if (left + right + top + bottom + blur === 0) return null

  const strokeWidth = style.strokeColor && style.strokeWidthMm > 0 ? style.strokeWidthMm * pxPerMm : 0
  const pad = Math.ceil(style.fontSizeMm * pxPerMm + strokeWidth)
  const mask = new Konva.Text({
    text: value,
    x: pad,
    y: pad,
    width,
    fontFamily: fontLabel(style.fontFamily),
    fontSize: style.fontSizeMm * pxPerMm,
    lineHeight: style.lineHeight,
    align: style.align,
    fill: style.shadowColor,
    letterSpacing: style.letterSpacingMm * pxPerMm,
    wrap: "word",
    listening: false,
    stroke: strokeWidth > 0 ? style.shadowColor : undefined,
    strokeWidth: strokeWidth > 0 ? strokeWidth : undefined,
    fillAfterStrokeEnabled: strokeWidth > 0,
  })
  const textHeight = mask.height()
  if (textHeight <= 0) return null
  const boxWidth = width + pad * 2
  const boxHeight = textHeight + pad * 2
  const source = mask.toCanvas({ x: 0, y: 0, width: boxWidth, height: boxHeight, pixelRatio: ratio })
  mask.destroy()
  if (source.width <= 0 || source.height <= 0) return null

  const dilated = dilate(source, left, right, top, bottom)
  const blurred = soften(dilated, blur, style.shadowColor)
  const blurPad = blur > 0 ? Math.ceil(blur * 2) : 0
  return {
    canvas: blurred,
    offsetX: -(pad + (left + blurPad) / ratio),
    offsetY: -(pad + (top + blurPad) / ratio),
    width: blurred.width / ratio,
    height: blurred.height / ratio,
  }
}

function shadowPixels(mm: number, pxPerMm: number, ratio: number): number {
  if (mm <= 0) return 0
  return Math.max(1, Math.round(mm * pxPerMm * ratio))
}

function dilate(source: HTMLCanvasElement, left: number, right: number, top: number, bottom: number): HTMLCanvasElement {
  const widened = stamp(source, left, right, 0, 0)
  return stamp(widened, 0, 0, top, bottom)
}

function stamp(source: HTMLCanvasElement, left: number, right: number, top: number, bottom: number): HTMLCanvasElement {
  if (left === 0 && right === 0 && top === 0 && bottom === 0) return source
  const canvas = document.createElement("canvas")
  canvas.width = source.width + left + right
  canvas.height = source.height + top + bottom
  const context = canvas.getContext("2d")
  if (!context) return source
  context.imageSmoothingEnabled = false
  if (top === 0 && bottom === 0) {
    for (let dx = -left; dx <= right; dx += 1) context.drawImage(source, left + dx, 0)
    return canvas
  }
  for (let dy = -top; dy <= bottom; dy += 1) context.drawImage(source, 0, top + dy)
  return canvas
}

function soften(source: HTMLCanvasElement, radius: number, color: string): HTMLCanvasElement {
  if (radius <= 0) return source
  const pad = Math.ceil(radius * 2)
  const canvas = document.createElement("canvas")
  canvas.width = source.width + pad * 2
  canvas.height = source.height + pad * 2
  const context = canvas.getContext("2d")
  if (!context) return source
  context.shadowColor = color
  context.shadowBlur = radius
  context.shadowOffsetX = 0
  context.shadowOffsetY = 0
  context.drawImage(source, pad, pad)
  return canvas
}
