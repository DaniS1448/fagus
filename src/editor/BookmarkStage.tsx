import Konva from "konva"
import { useLayoutEffect, useRef } from "react"
import { snapAngle, snapFrame } from "../domain/placement"
import type { ResolvedSide } from "../domain/resolve"
import { paintContent } from "./paintSide"

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
    layer.batchDraw()
  }, [props.side, props.images, props.guides, props.widthMm, props.heightMm, props.pxPerMm])

  useLayoutEffect(() => {
    const layer = stageRef.current?.getLayers()[0]
    if (!layer) return
    attachTransformer(layer, props.selectedId, props.pxPerMm)
    layer.batchDraw()
  }, [props.selectedId, props.pxPerMm])

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
    node.on("dragstart transformstart", () => propsRef.current.onGestureStart())
    node.on("dragend transformend", () => {
      const frame = readFrame(node, propsRef.current)
      propsRef.current.onCommitFrame(node.id(), frame)
    })
  })
}

function readFrame(group: Konva.Group, props: StageProps): Frame {
  const widthPx = Number(group.getAttr("widthPx")) * Math.abs(group.scaleX())
  const heightPx = Number(group.getAttr("heightPx")) * Math.abs(group.scaleY())
  const width = Math.max(4, widthPx / props.pxPerMm)
  const height = Math.max(4, heightPx / props.pxPerMm)
  const centerX = group.x() / props.pxPerMm
  const centerY = group.y() / props.pxPerMm
  const raw = {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    rotation: snapAngle(group.rotation()),
  }
  const snapped = snapFrame(raw, props.widthMm, props.heightMm)
  return { ...raw, x: snapped.x, y: snapped.y }
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
          anchorSize: 8,
          borderStroke: "#1F3A2E",
          anchorStroke: "#1F3A2E",
          anchorFill: "#F4F0E6",
          boundBoxFunc: (oldBox, newBox) => {
            if (newBox.width < 4 * pxPerMm || newBox.height < 4 * pxPerMm) return oldBox
            return newBox
          },
        })
  if (!(found instanceof Konva.Transformer)) layer.add(transformer)
  if (!selectedId) {
    transformer.nodes([])
    return
  }
  const node = layer.findOne(`#${cssEscape(selectedId)}`)
  transformer.nodes(node instanceof Konva.Group ? [node] : [])
  transformer.moveToTop()
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value
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
