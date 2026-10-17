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

export function snapFrame(
  frame: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number,
  threshold = 0.6,
): { x: number; y: number } {
  const xTargets = [0, (pageWidth - frame.width) / 2, pageWidth - frame.width]
  const yTargets = [0, (pageHeight - frame.height) / 2, pageHeight - frame.height]
  return {
    x: snapValue(frame.x, xTargets, threshold),
    y: snapValue(frame.y, yTargets, threshold),
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
