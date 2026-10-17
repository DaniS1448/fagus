import { paperSize, type Orientation, type PaperName } from "./units"

export type FlipEdge = "long" | "short"

export type CropMark = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type ImposeOptions = {
  paper: PaperName
  orientation: Orientation
  marginMm: number
  gapMm: number
  cropMarks: boolean
  flip: FlipEdge
  duplex: boolean
  bookmarkWidthMm: number
  bookmarkHeightMm: number
}

export type ImpositionItem = {
  id: string
  copyIndex: number
}

export type Placement = ImpositionItem & {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export type ImposedSheet = {
  widthMm: number
  heightMm: number
  cols: number
  rows: number
  front: Placement[]
  back: Placement[]
  frontCropMarks: CropMark[]
  backCropMarks: CropMark[]
}

export type ImposeResult = {
  fits: boolean
  perSheet: number
  sheets: ImposedSheet[]
}

const MARK_LENGTH_MM = 2.5
const MARK_GAP_MM = 0.8

export function impose(items: readonly ImpositionItem[], options: ImposeOptions): ImposeResult {
  const page = paperSize(options.paper, options.orientation)
  const capacity = gridCapacity(page.widthMm, page.heightMm, options)
  if (!capacity.fits || items.length === 0) {
    return { fits: capacity.fits, perSheet: capacity.perSheet, sheets: [] }
  }

  const sheets: ImposedSheet[] = []
  for (let start = 0; start < items.length; start += capacity.perSheet) {
    const slice = items.slice(start, start + capacity.perSheet)
    const front = slice.map((item, index) =>
      placementAt(item, index, capacity, options.bookmarkWidthMm, options.bookmarkHeightMm),
    )
    const back = options.duplex
      ? slice.map((item, index) => {
          const mirrored = mirrorIndex(index, capacity.cols, capacity.rows, page, options.flip)
          return placementAt(
            item,
            mirrored,
            capacity,
            options.bookmarkWidthMm,
            options.bookmarkHeightMm,
          )
        })
      : []
    sheets.push({
      widthMm: page.widthMm,
      heightMm: page.heightMm,
      cols: capacity.cols,
      rows: capacity.rows,
      front,
      back,
      frontCropMarks: options.cropMarks ? cropMarksFor(front, page.widthMm, page.heightMm) : [],
      backCropMarks: options.cropMarks ? cropMarksFor(back, page.widthMm, page.heightMm) : [],
    })
  }

  return { fits: true, perSheet: capacity.perSheet, sheets }
}

type Capacity = {
  fits: boolean
  perSheet: number
  cols: number
  rows: number
  originX: number
  originY: number
  stepX: number
  stepY: number
}

function gridCapacity(pageWidth: number, pageHeight: number, options: ImposeOptions): Capacity {
  const gap = Math.max(0, options.gapMm)
  const margin = Math.max(0, options.marginMm)
  const itemW = options.bookmarkWidthMm
  const itemH = options.bookmarkHeightMm
  const usableW = pageWidth - margin * 2
  const usableH = pageHeight - margin * 2
  if (itemW <= 0 || itemH <= 0 || itemW > usableW || itemH > usableH) {
    return { fits: false, perSheet: 0, cols: 0, rows: 0, originX: 0, originY: 0, stepX: 0, stepY: 0 }
  }
  const cols = Math.floor((usableW + gap) / (itemW + gap))
  const rows = Math.floor((usableH + gap) / (itemH + gap))
  const gridW = cols * itemW + (cols - 1) * gap
  const gridH = rows * itemH + (rows - 1) * gap
  return {
    fits: cols > 0 && rows > 0,
    perSheet: cols * rows,
    cols,
    rows,
    originX: (pageWidth - gridW) / 2,
    originY: (pageHeight - gridH) / 2,
    stepX: itemW + gap,
    stepY: itemH + gap,
  }
}

function placementAt(
  item: ImpositionItem,
  index: number,
  capacity: Capacity,
  widthMm: number,
  heightMm: number,
): Placement {
  const col = index % capacity.cols
  const row = Math.floor(index / capacity.cols)
  return {
    id: item.id,
    copyIndex: item.copyIndex,
    xMm: capacity.originX + col * capacity.stepX,
    yMm: capacity.originY + row * capacity.stepY,
    widthMm,
    heightMm,
  }
}

export function mirrorAxis(
  pageWidth: number,
  pageHeight: number,
  flip: FlipEdge,
): "x" | "y" {
  const portrait = pageHeight >= pageWidth
  if (flip === "long") return portrait ? "x" : "y"
  return portrait ? "y" : "x"
}

function mirrorIndex(
  index: number,
  cols: number,
  rows: number,
  page: { widthMm: number; heightMm: number },
  flip: FlipEdge,
): number {
  const col = index % cols
  const row = Math.floor(index / cols)
  const axis = mirrorAxis(page.widthMm, page.heightMm, flip)
  const nextCol = axis === "x" ? cols - 1 - col : col
  const nextRow = axis === "y" ? rows - 1 - row : row
  return nextRow * cols + nextCol
}

function cropMarksFor(placements: readonly Placement[], pageWidth: number, pageHeight: number): CropMark[] {
  const marks: CropMark[] = []
  for (const placement of placements) {
    const { xMm, yMm, widthMm, heightMm } = placement
    const corners = [
      { x: xMm, y: yMm, dx: -1, dy: -1 },
      { x: xMm + widthMm, y: yMm, dx: 1, dy: -1 },
      { x: xMm, y: yMm + heightMm, dx: -1, dy: 1 },
      { x: xMm + widthMm, y: yMm + heightMm, dx: 1, dy: 1 },
    ]
    for (const corner of corners) {
      const horizontal = clipLine(
        corner.x + corner.dx * MARK_GAP_MM,
        corner.y,
        corner.x + corner.dx * (MARK_GAP_MM + MARK_LENGTH_MM),
        corner.y,
        pageWidth,
        pageHeight,
      )
      const vertical = clipLine(
        corner.x,
        corner.y + corner.dy * MARK_GAP_MM,
        corner.x,
        corner.y + corner.dy * (MARK_GAP_MM + MARK_LENGTH_MM),
        pageWidth,
        pageHeight,
      )
      if (horizontal) marks.push(horizontal)
      if (vertical) marks.push(vertical)
    }
  }
  return marks
}

function clipLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pageWidth: number,
  pageHeight: number,
): CropMark | null {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= pageWidth && y <= pageHeight
  if (!inside(x1, y1) || !inside(x2, y2)) return null
  if (x1 === x2 && y1 === y2) return null
  return { x1, y1, x2, y2 }
}
