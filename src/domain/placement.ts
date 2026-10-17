export type FitMode = "cover" | "contain"

export type Placement = {
  x: number
  y: number
  width: number
  height: number
}

export function photoPlacement(input: {
  frameWidth: number
  frameHeight: number
  imageWidth: number
  imageHeight: number
  fit: FitMode
  scale: number
  offsetX: number
  offsetY: number
}): Placement {
  const frameWidth = input.frameWidth
  const frameHeight = input.frameHeight
  const imageWidth = Math.max(1, input.imageWidth)
  const imageHeight = Math.max(1, input.imageHeight)
  const scale = Math.max(0.05, input.scale)
  const offsetX = clamp(input.offsetX, -1, 1)
  const offsetY = clamp(input.offsetY, -1, 1)
  const imageRatio = imageWidth / imageHeight
  const frameRatio = frameWidth / frameHeight
  const imageWider = imageRatio > frameRatio
  const cover = input.fit === "cover"

  let width: number
  let height: number
  if (cover ? imageWider : !imageWider) {
    height = frameHeight
    width = frameHeight * imageRatio
  } else {
    width = frameWidth
    height = frameWidth / imageRatio
  }

  width *= scale
  height *= scale

  return {
    x: ((frameWidth - width) / 2) * (1 + offsetX),
    y: ((frameHeight - height) / 2) * (1 + offsetY),
    width,
    height,
  }
}

export function snapValue(value: number, targets: readonly number[], threshold: number): number {
  let best = value
  let bestDistance = threshold
  for (const target of targets) {
    const distance = Math.abs(value - target)
    if (distance <= bestDistance) {
      best = target
      bestDistance = distance
    }
  }
  return best
}

export type AlignLine = {
  axis: "x" | "y"
  at: number
}

export type AlignSnap = {
  x: number
  y: number
  lines: AlignLine[]
}

export function snapFrame(
  frame: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number,
  threshold = 0.6,
): { x: number; y: number } {
  const aligned = alignFrame(frame, { width: pageWidth, height: pageHeight }, [], threshold)
  return { x: aligned.x, y: aligned.y }
}

export function alignFrame(
  frame: { x: number; y: number; width: number; height: number },
  page: { width: number; height: number },
  others: readonly { x: number; y: number; width: number; height: number }[],
  threshold = 1,
): AlignSnap {
  const xTargets = [0, page.width / 2, page.width]
  const yTargets = [0, page.height / 2, page.height]
  for (const other of others) {
    xTargets.push(other.x, other.x + other.width / 2, other.x + other.width)
    yTargets.push(other.y, other.y + other.height / 2, other.y + other.height)
  }
  const x = snapEdge(frame.x, frame.width, xTargets, threshold)
  const y = snapEdge(frame.y, frame.height, yTargets, threshold)
  const lines: AlignLine[] = [
    ...matchedEdges(x, frame.width, xTargets).map((at) => ({ axis: "x" as const, at })),
    ...matchedEdges(y, frame.height, yTargets).map((at) => ({ axis: "y" as const, at })),
  ]
  return { x, y, lines }
}

function snapEdge(start: number, size: number, targets: readonly number[], threshold: number): number {
  const offsets = [0, size / 2, size]
  let bestStart = start
  let bestDistance = threshold
  let found = false
  for (const target of targets) {
    for (const offset of offsets) {
      const next = target - offset
      const distance = Math.abs(start - next)
      if (distance < bestDistance || (distance === bestDistance && !found)) {
        bestDistance = distance
        bestStart = next
        found = true
      }
    }
  }
  return found ? bestStart : start
}

function matchedEdges(start: number, size: number, targets: readonly number[]): number[] {
  const offsets = [0, size / 2, size]
  const found: number[] = []
  for (const target of targets) {
    const hit = offsets.some((offset) => Math.abs(start + offset - target) <= 0.05)
    if (hit && !found.includes(target)) found.push(target)
  }
  return found
}

export type ResizeBox = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

type EdgeAnchor = "middle-left" | "middle-right" | "top-center" | "bottom-center"

function edgeAnchor(anchor: string | null): EdgeAnchor | null {
  switch (anchor) {
    case "middle-left":
    case "middle-right":
    case "top-center":
    case "bottom-center":
      return anchor
    default:
      return null
  }
}

export function resizeKeepingRatio(oldBox: ResizeBox, newBox: ResizeBox, anchor: string | null): ResizeBox {
  const edge = edgeAnchor(anchor)
  if (!edge || oldBox.width === 0 || oldBox.height === 0) return newBox
  const scale = edge === "middle-left" || edge === "middle-right" ? newBox.width / oldBox.width : newBox.height / oldBox.height
  if (!Number.isFinite(scale)) return oldBox
  const fixed = fixedEdgePoint(edge, oldBox.width, oldBox.height)
  const cos = Math.cos(oldBox.rotation)
  const sin = Math.sin(oldBox.rotation)
  const dx = fixed.x * (1 - scale)
  const dy = fixed.y * (1 - scale)
  return {
    x: oldBox.x + dx * cos - dy * sin,
    y: oldBox.y + dx * sin + dy * cos,
    width: oldBox.width * scale,
    height: oldBox.height * scale,
    rotation: oldBox.rotation,
  }
}

function fixedEdgePoint(anchor: EdgeAnchor, width: number, height: number): { x: number; y: number } {
  switch (anchor) {
    case "middle-left":
      return { x: width, y: height / 2 }
    case "middle-right":
      return { x: 0, y: height / 2 }
    case "top-center":
      return { x: width / 2, y: height }
    case "bottom-center":
      return { x: width / 2, y: 0 }
    default: {
      const unknown: never = anchor
      return unknown
    }
  }
}

export function snapAngle(degrees: number): number {
  const turns = [0, 90, 180, 270, 360, -90, -180, -270]
  const nearest = snapValue(degrees, turns, 2)
  if (nearest === 360) return 0
  if (nearest === -180) return 180
  if (nearest === -270) return 90
  return nearest
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
