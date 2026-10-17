import Konva from "konva"
import type { TextStyle } from "../domain/document"
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
      paintQuote(group, element, width, pxPerMm)
      break
    case "bible":
      paintBible(group, element, width, pxPerMm)
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
  pxPerMm: number,
) {
  const body = addFlowingText(group, element.text, element.style, 0, 0, width, pxPerMm)
  const attribution = attributionLine(element.attribution)
  if (!attribution) return
  addFlowingText(
    group,
    attribution,
    { ...element.style, fontSizeMm: element.style.fontSizeMm * 0.78 },
    0,
    body.height() + element.gapMm * pxPerMm,
    width,
    pxPerMm,
  )
}

function paintBible(
  group: Konva.Group,
  element: Extract<ResolvedElement, { type: "bible" }>,
  width: number,
  pxPerMm: number,
) {
  const body = addFlowingText(group, element.text, element.style, 0, 0, width, pxPerMm)
  if (!element.showReference || !element.reference) return
  addFlowingText(
    group,
    element.reference,
    element.referenceStyle,
    0,
    body.height() + element.gapMm * pxPerMm,
    width,
    pxPerMm,
  )
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
    paintRaster(group, element.imageId, element, width, height, images)
    return
  }
  if (element.kind === "missing") return
  const text = addText(group, element.text, element.style, 0, 0, width, height, pxPerMm)
  const used = text.height()
  text.y(Math.max(0, (height - used) / 2))
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
  })
  group.add(text)
  return text
}

function addText(
  group: Konva.Group,
  value: string,
  style: TextStyle,
  x: number,
  y: number,
  width: number,
  height: number,
  pxPerMm: number,
): Konva.Text {
  const text = new Konva.Text({
    text: value,
    x,
    y,
    width,
    height,
    fontFamily: fontLabel(style.fontFamily),
    fontSize: style.fontSizeMm * pxPerMm,
    lineHeight: style.lineHeight,
    align: style.align,
    fill: style.color,
    letterSpacing: style.letterSpacingMm * pxPerMm,
    wrap: "word",
    listening: false,
  })
  group.add(text)
  return text
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
