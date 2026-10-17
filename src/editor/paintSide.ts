import Konva from "konva"
import type { Plate, TextStyle } from "../domain/document"
import { fontLabel } from "../domain/fonts"
import { photoPlacement } from "../domain/placement"
import type { ResolvedElement, ResolvedSide } from "../domain/resolve"
import { DEFAULT_BLEED_GUIDE_MM } from "../domain/units"

export type PaintOptions = {
  side: ResolvedSide
  widthMm: number
  heightMm: number
  pxPerMm: number
  images: ReadonlyMap<string, HTMLImageElement>
  guides: boolean
}

export function paintContent(layer: Konva.Layer, options: PaintOptions) {
  const existing = layer.findOne("#content")
  const content = existing instanceof Konva.Group ? existing : new Konva.Group({ id: "content" })
  if (!existing) layer.add(content)
  content.destroyChildren()
  const px = (mm: number) => mm * options.pxPerMm
  content.add(
    new Konva.Rect({
      name: "page-background",
      x: 0,
      y: 0,
      width: px(options.widthMm),
      height: px(options.heightMm),
      fill: options.side.background,
    }),
  )

  for (const element of options.side.elements) {
    content.add(paintElement(element, options.pxPerMm, options.images))
  }

  if (options.guides) {
    const inset = px(DEFAULT_BLEED_GUIDE_MM)
    content.add(
      new Konva.Rect({
        name: "safe-guide",
        x: inset,
        y: inset,
        width: Math.max(0, px(options.widthMm) - inset * 2),
        height: Math.max(0, px(options.heightMm) - inset * 2),
        stroke: "rgba(31, 58, 46, 0.55)",
        strokeWidth: 1,
        dash: [4, 4],
        listening: false,
      }),
    )
  }
}

function paintElement(
  element: ResolvedElement,
  pxPerMm: number,
  images: ReadonlyMap<string, HTMLImageElement>,
): Konva.Group {
  const px = (mm: number) => mm * pxPerMm
  const width = px(element.width)
  const height = px(element.height)
  const group = new Konva.Group({
    id: element.id,
    name: "element",
    x: px(element.x + element.width / 2),
    y: px(element.y + element.height / 2),
    offsetX: width / 2,
    offsetY: height / 2,
    width,
    height,
    rotation: element.rotation,
    draggable: true,
  })
  group.setAttr("widthPx", width)
  group.setAttr("heightPx", height)
  group.clip({ x: 0, y: 0, width, height })
  group.add(new Konva.Rect({ name: "hit", x: 0, y: 0, width, height, fill: "#000", opacity: 0 }))

  switch (element.type) {
    case "photo":
      paintRaster(group, element.photoId, element, width, height, images)
      break
    case "quote":
      paintQuote(group, element, width, height, pxPerMm)
      break
    case "bible":
      paintBible(group, element, width, height, pxPerMm)
      break
    case "identity":
      paintIdentity(group, element, width, height, pxPerMm, images)
      break
    default: {
      const unknown: never = element
      return unknown
    }
  }

  if (element.broken) paintBroken(group, width, height)
  return group
}

function paintRaster(
  group: Konva.Group,
  imageId: string | null,
  element: { imageWidth: number; imageHeight: number; fit: "cover" | "contain"; scale: number; offsetX: number; offsetY: number },
  width: number,
  height: number,
  images: ReadonlyMap<string, HTMLImageElement>,
) {
  const image = imageId ? images.get(imageId) : undefined
  if (!image) return
  const placed = photoPlacement({
    frameWidth: width,
    frameHeight: height,
    imageWidth: image.naturalWidth || element.imageWidth,
    imageHeight: image.naturalHeight || element.imageHeight,
    fit: element.fit,
    scale: element.scale,
    offsetX: element.offsetX,
    offsetY: element.offsetY,
  })
  group.add(
    new Konva.Image({
      image,
      x: placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
      listening: false,
    }),
  )
}

function paintQuote(
  group: Konva.Group,
  element: Extract<ResolvedElement, { type: "quote" }>,
  width: number,
  height: number,
  pxPerMm: number,
) {
  const pad = padsOf(element.plate, pxPerMm, width)
  const innerWidth = Math.max(1, width - pad.left - pad.right)
  const body = addFlowingText(group, element.text, element.style, pad.left, pad.top, innerWidth, pxPerMm)
  const attribution = attributionLine(element.attribution)
  let contentBottom = pad.top + body.height()
  if (attribution) {
    const line = addFlowingText(
      group,
      attribution,
      { ...element.style, fontSizeMm: element.style.fontSizeMm * 0.78 },
      pad.left,
      contentBottom + element.gapMm * pxPerMm,
      innerWidth,
      pxPerMm,
    )
    contentBottom = line.y() + line.height()
  }
  paintPlate(group, element.plate, 0, 0, width, Math.min(height, contentBottom + pad.bottom), pxPerMm)
}

function paintBible(
  group: Konva.Group,
  element: Extract<ResolvedElement, { type: "bible" }>,
  width: number,
  height: number,
  pxPerMm: number,
) {
  const pad = padsOf(element.plate, pxPerMm, width)
  const innerWidth = Math.max(1, width - pad.left - pad.right)
  const body = addFlowingText(group, element.text, element.style, pad.left, pad.top, innerWidth, pxPerMm)
  let contentBottom = pad.top + body.height()
  if (element.showReference && element.reference) {
    const line = addFlowingText(
      group,
      element.reference,
      element.referenceStyle,
      pad.left,
      contentBottom + element.gapMm * pxPerMm,
      innerWidth,
      pxPerMm,
    )
    contentBottom = line.y() + line.height()
  }
  paintPlate(group, element.plate, 0, 0, width, Math.min(height, contentBottom + pad.bottom), pxPerMm)
}

function paintIdentity(
  group: Konva.Group,
  element: Extract<ResolvedElement, { type: "identity" }>,
  width: number,
  height: number,
  pxPerMm: number,
  images: ReadonlyMap<string, HTMLImageElement>,
) {
  if (element.kind === "logo") {
    const image = element.imageId ? images.get(element.imageId) : undefined
    if (image) {
      const placed = photoPlacement({
        frameWidth: width,
        frameHeight: height,
        imageWidth: image.naturalWidth || element.imageWidth,
        imageHeight: image.naturalHeight || element.imageHeight,
        fit: element.fit,
        scale: element.scale,
        offsetX: element.offsetX,
        offsetY: element.offsetY,
      })
      const pad = padsOf(element.plate, pxPerMm, width)
      const x = Math.max(0, placed.x - pad.left)
      const y = Math.max(0, placed.y - pad.top)
      const right = Math.min(width, placed.x + placed.width + pad.right)
      const bottom = Math.min(height, placed.y + placed.height + pad.bottom)
      paintPlate(group, element.plate, x, y, right - x, bottom - y, pxPerMm)
    }
    paintRaster(group, element.imageId, element, width, height, images)
    return
  }
  if (element.kind === "missing") return
  const pad = padsOf(element.plate, pxPerMm, width)
  const innerWidth = Math.max(1, width - pad.left - pad.right)
  const text = addFlowingText(group, element.text, element.style, pad.left, 0, innerWidth, pxPerMm)
  const used = text.height()
  const block = Math.min(height, used + pad.top + pad.bottom)
  const top = Math.max(0, (height - block) / 2)
  text.y(top + pad.top)
  paintPlate(group, element.plate, 0, top, width, block, pxPerMm)
}

function addFlowingText(
  group: Konva.Group,
  value: string,
  style: TextStyle,
  x: number,
  y: number,
  width: number,
  pxPerMm: number,
): Konva.Text {
  const text = new Konva.Text({
    text: value,
    x,
    y,
    width,
    fontFamily: fontLabel(style.fontFamily),
    fontSize: style.fontSizeMm * pxPerMm,
    lineHeight: style.lineHeight,
    align: style.align,
    fill: style.color,
    letterSpacing: style.letterSpacingMm * pxPerMm,
    wrap: "word",
    listening: false,
    ...strokeOf(style, pxPerMm),
  })
  group.add(text)
  return text
}

function strokeOf(style: TextStyle, pxPerMm: number): { stroke?: string; strokeWidth?: number; fillAfterStrokeEnabled?: boolean } {
  if (!style.strokeColor || style.strokeWidthMm <= 0) return {}
  return {
    stroke: style.strokeColor,
    strokeWidth: style.strokeWidthMm * pxPerMm,
    fillAfterStrokeEnabled: true,
  }
}

function padsOf(plate: Plate, pxPerMm: number, width: number) {
  let left = Math.max(0, plate.paddingLeftMm) * pxPerMm
  let right = Math.max(0, plate.paddingRightMm) * pxPerMm
  const span = left + right
  if (span > width && span > 0) {
    const scale = width / span
    left *= scale
    right *= scale
  }
  return {
    top: Math.max(0, plate.paddingTopMm) * pxPerMm,
    right,
    bottom: Math.max(0, plate.paddingBottomMm) * pxPerMm,
    left,
  }
}

function paintPlate(
  group: Konva.Group,
  plate: Plate,
  x: number,
  y: number,
  width: number,
  height: number,
  pxPerMm: number,
) {
  if (!plate?.color || plate.opacity <= 0 || width <= 0 || height <= 0) return
  const radius = Math.min(Math.max(0, plate.radiusMm) * pxPerMm, width / 2, height / 2)
  const rect = new Konva.Rect({
    x,
    y,
    width,
    height,
    cornerRadius: radius,
    fill: plate.color,
    opacity: plate.opacity,
    listening: false,
  })
  group.add(rect)
  rect.moveToBottom()
}

function paintBroken(group: Konva.Group, width: number, height: number) {
  group.add(
    new Konva.Rect({
      x: 1,
      y: 1,
      width: Math.max(0, width - 2),
      height: Math.max(0, height - 2),
      stroke: "#8F2D2D",
      strokeWidth: 1.5,
      listening: false,
    }),
  )
  group.add(
    new Konva.Text({
      text: "Falta en la biblioteca",
      x: 4,
      y: 4,
      width: Math.max(0, width - 8),
      fontFamily: "Outfit",
      fontSize: Math.max(10, Math.min(16, height / 5)),
      fill: "#8F2D2D",
      listening: false,
    }),
  )
}

function attributionLine(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return `— ${trimmed.replace(/^—\s*/, "")}`
}
