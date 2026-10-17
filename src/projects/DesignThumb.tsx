import Konva from "konva"
import { useEffect, useMemo, useState } from "react"
import type { SideDocument } from "../domain/document"
import type { Design, Identity } from "../domain/models"
import { mixSeed } from "../domain/random"
import { resolveDocument, type LibrarySnapshot } from "../domain/resolve"
import { paintContent } from "../editor/paintSide"
import { loadHtmlImage } from "../media"

const THUMB_MAX_HEIGHT = 168
const THUMB_MAX_WIDTH = 72

export function thumbBox(widthMm: number, heightMm: number) {
  const pxPerMm = Math.min(THUMB_MAX_HEIGHT / heightMm, THUMB_MAX_WIDTH / widthMm)
  return {
    pxPerMm,
    width: Math.max(1, Math.round(widthMm * pxPerMm)),
    height: Math.max(1, Math.round(heightMm * pxPerMm)),
  }
}

export function useDesignImages(designs: Design[] | undefined, identities: Identity[] | undefined) {
  const photoKey = useMemo(() => referencedPhotoIds(designs ?? []).join(","), [designs])
  const logoKey = useMemo(() => referencedLogoIds(designs ?? [], identities ?? []).join(","), [designs, identities])
  const [images, setImages] = useState<ReadonlyMap<string, HTMLImageElement>>(() => new Map())

  useEffect(() => {
    let cancelled = false
    const jobs: Array<Promise<readonly [string, HTMLImageElement] | null>> = []
    for (const id of splitIds(photoKey)) {
      jobs.push(loadPreviewImage(id, `/api/photos/${id}/thumbnail`))
    }
    for (const id of splitIds(logoKey)) {
      jobs.push(loadPreviewImage(id, `/api/identities/${id}/thumbnail`))
    }
    void Promise.all(jobs).then((entries) => {
      if (cancelled) return
      const next = new Map<string, HTMLImageElement>()
      for (const entry of entries) {
        if (entry) next.set(entry[0], entry[1])
      }
      setImages(next)
    })
    return () => {
      cancelled = true
    }
  }, [photoKey, logoKey])

  return images
}

export function DesignThumb({
  side,
  widthMm,
  heightMm,
  seed,
  libraries,
  images,
}: {
  side: SideDocument
  widthMm: number
  heightMm: number
  seed: number
  libraries: LibrarySnapshot
  images: ReadonlyMap<string, HTMLImageElement>
}) {
  const resolved = useMemo(
    () => resolveDocument(side, libraries, mixSeed(seed, 0)),
    [side, libraries, seed],
  )
  const box = thumbBox(widthMm, heightMm)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (cancelled) return
      setUrl(renderSideThumb(resolved, widthMm, heightMm, box.pxPerMm, images))
    })
    return () => {
      cancelled = true
    }
  }, [resolved, widthMm, heightMm, box.pxPerMm, images])

  return (
    <span
      className="block bg-paper shadow-[0_8px_18px_rgba(26,24,20,0.16)]"
      style={{ width: box.width, height: box.height, background: resolved.background }}
    >
      {url ? <img src={url} alt="" className="block h-full w-full" draggable={false} /> : null}
    </span>
  )
}

function renderSideThumb(
  side: ReturnType<typeof resolveDocument>,
  widthMm: number,
  heightMm: number,
  pxPerMm: number,
  images: ReadonlyMap<string, HTMLImageElement>,
) {
  const host = document.createElement("div")
  const width = Math.max(1, Math.round(widthMm * pxPerMm))
  const height = Math.max(1, Math.round(heightMm * pxPerMm))
  const stage = new Konva.Stage({ container: host, width, height, listening: false })
  const layer = new Konva.Layer({ listening: false })
  stage.add(layer)
  paintContent(layer, { side, widthMm, heightMm, pxPerMm, images, guides: false })
  layer.find(".element").forEach((node) => {
    node.draggable(false)
    node.listening(false)
  })
  layer.draw()
  const url = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" })
  stage.destroy()
  return url
}

function referencedPhotoIds(designs: readonly Design[]) {
  const ids = new Set<string>()
  for (const design of designs) {
    for (const element of [...design.front.elements, ...design.back.elements]) {
      if (element.type === "photo") ids.add(element.photoId)
    }
  }
  return [...ids].sort()
}

function referencedLogoIds(designs: readonly Design[], identities: readonly Identity[]) {
  const logos = new Set(identities.flatMap((item) => (item.kind === "logo" ? [item.id] : [])))
  const ids = new Set<string>()
  for (const design of designs) {
    for (const element of [...design.front.elements, ...design.back.elements]) {
      if (element.type === "identity" && logos.has(element.identityId)) ids.add(element.identityId)
    }
  }
  return [...ids].sort()
}

function splitIds(key: string) {
  return key.length === 0 ? [] : key.split(",")
}

function loadPreviewImage(id: string, url: string) {
  return loadHtmlImage(url)
    .then((image) => [id, image] as const)
    .catch(() => null)
}
