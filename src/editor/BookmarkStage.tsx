import Konva from "konva"
import { useLayoutEffect, useRef } from "react"
import { alignFrame, resizeKeepingRatio, snapAngle, type AlignLine } from "../domain/placement"
import type { ResolvedSide } from "../domain/resolve"
import { paintContent } from "./paintSide"

let freeRatio = false
let activeTransformer: Konva.Transformer | null = null

function syncFreeRatio(event: Event) {
  if (!("ctrlKey" in event)) return
  freeRatio = Boolean((event as MouseEvent).ctrlKey)
  activeTransformer?.keepRatio(!freeRatio)
}

if (typeof window !== "undefined") {
  const view = window as Window & { __fagusSyncRatio?: (event: Event) => void }
  if (view.__fagusSyncRatio) {
    window.removeEventListener("keydown", view.__fagusSyncRatio, true)
    window.removeEventListener("keyup", view.__fagusSyncRatio, true)
    window.removeEventListener("pointerdown", view.__fagusSyncRatio, true)
    window.removeEventListener("mousemove", view.__fagusSyncRatio, true)
  }
  view.__fagusSyncRatio = syncFreeRatio
  window.addEventListener("keydown", syncFreeRatio, true)
  window.addEventListener("keyup", syncFreeRatio, true)
  window.addEventListener("pointerdown", syncFreeRatio, true)
  window.addEventListener("mousemove", syncFreeRatio, true)
}

type Frame = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

type StageProps = {
  side: ResolvedSide
  widthMm: number
  heightMm: number
  pxPerMm: number
  images: ReadonlyMap<string, HTMLImageElement>
  guides: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  onGestureStart: () => void
  onCommitFrame: (id: string, frame: Frame) => void
}

export function BookmarkStage(props: StageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const stage = new Konva.Stage({
      container,
      width: Math.max(1, Math.round(props.widthMm * props.pxPerMm)),
      height: Math.max(1, Math.round(props.heightMm * props.pxPerMm)),
    })
    stage.add(new Konva.Layer())
    stage.on("mousedown touchstart", (event) => {
      if (event.target === stage || event.target.name() === "page-background") {
        propsRef.current.onSelect(null)
      }
    })
    stageRef.current = stage
    return () => {
      if (activeTransformer?.getStage() === stage) activeTransformer = null
      stage.destroy()
      stageRef.current = null
      container.replaceChildren()
    }
  }, [props.widthMm, props.heightMm, props.pxPerMm])

  useLayoutEffect(() => {
    const layer = stageRef.current?.getLayers()[0]
    if (!layer) return
    paintContent(layer, props)
    bindElements(layer, propsRef)
    attachTransformer(layer, propsRef.current.selectedId, props.pxPerMm)
    drawAlignGuides(layer, restingLines(props), props)
    layer.batchDraw()
  }, [props.side, props.images, props.guides, props.widthMm, props.heightMm, props.pxPerMm])

  useLayoutEffect(() => {
    const layer = stageRef.current?.getLayers()[0]
    if (!layer) return
    attachTransformer(layer, props.selectedId, props.pxPerMm)
    drawAlignGuides(layer, restingLines(props), props)
    layer.batchDraw()
  }, [props.selectedId, props.pxPerMm, props.side])

  const ruler = 24
  const pageWidth = Math.max(1, Math.round(props.widthMm * props.pxPerMm))
  const pageHeight = Math.max(1, Math.round(props.heightMm * props.pxPerMm))
  return (
    <div className="relative w-fit" style={{ paddingLeft: ruler, paddingTop: ruler }}>
      <Ruler axis="x" lengthMm={props.widthMm} pxPerMm={props.pxPerMm} offset={ruler} />
      <Ruler axis="y" lengthMm={props.heightMm} pxPerMm={props.pxPerMm} offset={ruler} />
      <div
        ref={containerRef}
        className="bg-paper shadow-[0_18px_40px_rgba(26,24,20,0.18)]"
        style={{ width: pageWidth, height: pageHeight }}
        role="application"
        aria-label="Marcapáginas"
      />
    </div>
  )
}

function bindElements(layer: Konva.Layer, propsRef: { current: StageProps }) {
  layer.find(".element").forEach((node) => {
    if (!(node instanceof Konva.Group)) return
    node.off("mousedown dragstart dragend transformstart transformend")
    node.on("mousedown", (event) => {
      event.cancelBubble = true
      propsRef.current.onSelect(node.id())
    })
    node.dragBoundFunc((pos) => boundDrag(pos, node, propsRef.current))
    node.on("dragstart transformstart", () => propsRef.current.onGestureStart())
    node.on("dragmove", () => {
      drawAlignGuides(layer, node.getAttr("alignLines"), propsRef.current)
    })
    node.on("dragend transformend", () => {
      clearAlignGuides(layer)
      const frame = readFrame(node, propsRef.current)
      propsRef.current.onCommitFrame(node.id(), frame)
    })
  })
}

function boxOf(group: Konva.Group, pxPerMm: number): { width: number; height: number } {
  const width = Math.max(4, (Number(group.getAttr("widthPx")) * Math.abs(group.scaleX())) / pxPerMm)
  const height = Math.max(4, (Number(group.getAttr("heightPx")) * Math.abs(group.scaleY())) / pxPerMm)
  return { width, height }
}

function alignNode(
  frame: { x: number; y: number; width: number; height: number },
  id: string,
  props: StageProps,
  threshold?: number,
) {
  const others = props.side.elements
    .filter((element) => element.id !== id)
    .map((element) => ({ x: element.x, y: element.y, width: element.width, height: element.height }))
  return alignFrame(frame, { width: props.widthMm, height: props.heightMm }, others, threshold)
}

function restingLines(props: StageProps): AlignLine[] {
  if (!props.selectedId) return []
  const element = props.side.elements.find((item) => item.id === props.selectedId)
  if (!element) return []
  return alignNode(element, element.id, props, 0.05).lines
}

function boundDrag(pos: { x: number; y: number }, group: Konva.Group, props: StageProps): { x: number; y: number } {
  const { width, height } = boxOf(group, props.pxPerMm)
  const raw = {
    x: pos.x / props.pxPerMm - width / 2,
    y: pos.y / props.pxPerMm - height / 2,
    width,
    height,
  }
  const aligned = alignNode(raw, group.id(), props)
  group.setAttr("alignLines", aligned.lines)
  return {
    x: (aligned.x + width / 2) * props.pxPerMm,
    y: (aligned.y + height / 2) * props.pxPerMm,
  }
}

function readFrame(group: Konva.Group, props: StageProps): Frame {
  const { width, height } = boxOf(group, props.pxPerMm)
  const centerX = group.x() / props.pxPerMm
  const centerY = group.y() / props.pxPerMm
  const raw = {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    rotation: snapAngle(group.rotation()),
  }
  const aligned = alignNode(raw, group.id(), props)
  return { ...raw, x: aligned.x, y: aligned.y }
}

const ALIGN_GUIDE = "#8F2D2D"

function drawAlignGuides(layer: Konva.Layer, lines: unknown, props: StageProps) {
  const guides = linesOf(lines)
  const group = guideGroup(layer)
  group.destroyChildren()
  const px = props.pxPerMm
  const width = props.widthMm * px
  const height = props.heightMm * px
  for (const line of guides) {
    const at = line.at * px
    const points = line.axis === "x" ? [at, 0, at, height] : [0, at, width, at]
    group.add(
      new Konva.Line({
        points,
        stroke: "#F4F0E6",
        strokeWidth: 3,
        listening: false,
        perfectDrawEnabled: false,
      }),
    )
    group.add(
      new Konva.Line({
        points,
        stroke: ALIGN_GUIDE,
        strokeWidth: 1,
        listening: false,
        perfectDrawEnabled: false,
      }),
    )
  }
  group.moveToTop()
  layer.findOne("#transformer")?.moveToTop()
  layer.batchDraw()
}

function guideGroup(layer: Konva.Layer): Konva.Group {
  const found = layer.findOne("#align-guides")
  if (found instanceof Konva.Group) return found
  const created = new Konva.Group({ id: "align-guides", listening: false })
  layer.add(created)
  return created
}

function linesOf(value: unknown): AlignLine[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((line) => {
    if (!line || typeof line !== "object") return []
    const record = line as { axis?: unknown; at?: unknown }
    if ((record.axis === "x" || record.axis === "y") && typeof record.at === "number") {
      return [{ axis: record.axis, at: record.at }]
    }
    return []
  })
}

function clearAlignGuides(layer: Konva.Layer) {
  const group = layer.findOne("#align-guides")
  if (group instanceof Konva.Group) group.destroyChildren()
  layer.batchDraw()
}

function attachTransformer(layer: Konva.Layer, selectedId: string | null, pxPerMm: number) {
  const found = layer.findOne("#transformer")
  const transformer =
    found instanceof Konva.Transformer
      ? found
      : new Konva.Transformer({
          id: "transformer",
          rotateEnabled: true,
          flipEnabled: false,
          keepRatio: true,
          shiftBehavior: "none",
          anchorSize: 8,
          borderStroke: "#1F3A2E",
          anchorStroke: "#1F3A2E",
          anchorFill: "#F4F0E6",
        })
  if (!(found instanceof Konva.Transformer)) layer.add(transformer)
  activeTransformer = transformer
  transformer.keepRatio(!freeRatio)
  transformer.boundBoxFunc((oldBox, newBox) => {
    const min = 4 * pxPerMm
    if (freeRatio) {
      if (Math.abs(newBox.width) < min || Math.abs(newBox.height) < min) return oldBox
      return newBox
    }
    const locked = resizeKeepingRatio(oldBox, newBox, transformer.getActiveAnchor())
    if (Math.abs(locked.width) < min || Math.abs(locked.height) < min) return oldBox
    return locked
  })
  if (!selectedId) {
    transformer.nodes([])
    return
  }
  const node = layer.findOne(`#${selectedId}`)
  transformer.nodes(node instanceof Konva.Group ? [node] : [])
  transformer.moveToTop()
}

function Ruler({
  axis,
  lengthMm,
  pxPerMm,
  offset,
}: {
  axis: "x" | "y"
  lengthMm: number
  pxPerMm: number
  offset: number
}) {
  const ticks: number[] = []
  for (let mm = 0; mm <= lengthMm + 0.01; mm += 10) ticks.push(Math.min(lengthMm, mm))
  const size = Math.round(lengthMm * pxPerMm)
  if (axis === "x") {
    return (
      <div className="absolute top-0 text-[10px] text-ink/70" style={{ left: offset, width: size, height: offset }}>
        {ticks.map((mm) => (
          <span key={mm} className="absolute top-1" style={{ left: mm * pxPerMm }}>
            {Math.round(mm)}
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="absolute left-0 text-[10px] text-ink/70" style={{ top: offset, height: size, width: offset }}>
      {ticks.map((mm) => (
        <span key={mm} className="absolute left-0" style={{ top: mm * pxPerMm }}>
          {Math.round(mm)}
        </span>
      ))}
    </div>
  )
}
