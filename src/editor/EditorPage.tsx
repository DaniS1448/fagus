import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { apiGet, apiJson } from "../api"
import { buildPdf } from "../domain/pdf"
import { parsedDesign } from "../domain/document"
import { designPayload, type BibleText, type Design, type Identity, type ItemGroup, type Photo, type PhotoGroup, type Quote } from "../domain/models"
import { mixSeed } from "../domain/random"
import { resolveDocument, type LibrarySnapshot } from "../domain/resolve"
import { downloadBlob, slugify } from "../media"
import { Button, Notice } from "../ui/controls"
import { BookmarkStage } from "./BookmarkStage"
import { CreateDialog, type DialogKind } from "./CreateDialog"
import { Properties } from "./Properties"
import { activeDocument, useEditorStore } from "./store"
import { ToolRail } from "./ToolRail"
import { renderSidePng } from "../export/renderSide"
import { useLibraryImages } from "./useLibraryImages"

const SCREEN_PX_PER_MM = 96 / 25.4

export function EditorPage() {
  const { projectId = "", designId = "" } = useParams()
  const designQuery = useQuery({
    queryKey: ["design", designId],
    queryFn: async () => parsedDesign(await apiGet<Design>(`/api/designs/${designId}`)),
  })
  const photos = useQuery({ queryKey: ["photos"], queryFn: () => apiGet<Photo[]>("/api/photos") })
  const groups = useQuery({ queryKey: ["photo-groups"], queryFn: () => apiGet<PhotoGroup[]>("/api/photo-groups") })
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: () => apiGet<Quote[]>("/api/quotes") })
  const quoteGroups = useQuery({ queryKey: ["quote-groups"], queryFn: () => apiGet<ItemGroup[]>("/api/quote-groups") })
  const bible = useQuery({ queryKey: ["bible"], queryFn: () => apiGet<BibleText[]>("/api/bible-texts") })
  const bibleGroups = useQuery({ queryKey: ["bible-groups"], queryFn: () => apiGet<ItemGroup[]>("/api/bible-groups") })
  const identities = useQuery({ queryKey: ["identities"], queryFn: () => apiGet<Identity[]>("/api/identities") })
  const identityGroups = useQuery({ queryKey: ["identity-groups"], queryFn: () => apiGet<ItemGroup[]>("/api/identity-groups") })
  const images = useLibraryImages(photos.data, identities.data)
  const draft = useEditorStore((state) => state.draft)
  const side = useEditorStore((state) => state.side)
  const selectedId = useEditorStore((state) => state.selectedId)
  const guides = useEditorStore((state) => state.guides)
  const past = useEditorStore((state) => state.past)
  const future = useEditorStore((state) => state.future)
  const hydrate = useEditorStore((state) => state.hydrate)
  const setSide = useEditorStore((state) => state.setSide)
  const toggleGuides = useEditorStore((state) => state.toggleGuides)
  const select = useEditorStore((state) => state.select)
  const beginGesture = useEditorStore((state) => state.beginGesture)
  const endGesture = useEditorStore((state) => state.endGesture)
  const live = useEditorStore((state) => state.live)
  const commit = useEditorStore((state) => state.commit)
  const patchSelected = useEditorStore((state) => state.patchSelected)
  const commitFrame = useEditorStore((state) => state.commitFrame)
  const removeSelected = useEditorStore((state) => state.removeSelected)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const [pxPerMm, setPxPerMm] = useState(SCREEN_PX_PER_MM)
  const [status, setStatus] = useState<"saved" | "saving" | "dirty" | "error">("saved")
  const [exportError, setExportError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const savedJson = useRef("")
  const hydratedId = useRef<string | null>(null)
  const fittedId = useRef<string | null>(null)

  useEffect(() => {
    const design = designQuery.data
    if (!design || hydratedId.current === design.id) return
    hydratedId.current = design.id
    savedJson.current = JSON.stringify(designPayload(design))
    hydrate(design)
  }, [designQuery.data, hydrate])

  useEffect(() => {
    if (!draft) return
    const json = JSON.stringify(designPayload(draft))
    if (json === savedJson.current) {
      setStatus("saved")
      return
    }
    setStatus("dirty")
    const timer = window.setTimeout(() => {
      setStatus("saving")
      void apiJson(`/api/designs/${draft.id}`, "PATCH", designPayload(draft))
        .then(() => {
          savedJson.current = json
          setStatus("saved")
        })
        .catch(() => setStatus("error"))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [draft])

  useEffect(() => {
    return () => {
      const current = useEditorStore.getState().draft
      if (!current) return
      const json = JSON.stringify(designPayload(current))
      if (json === savedJson.current) return
      void fetch(`/api/designs/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: json,
        keepalive: true,
      })
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target)) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        removeSelected()
        return
      }
      if (event.key === "Escape") select(null)
      const step = event.shiftKey ? 1 : 0.2
      const delta = arrowDelta(event.key, step)
      if (!delta) return
      event.preventDefault()
      patchSelected((element) => ({ ...element, x: element.x + delta.x, y: element.y + delta.y }))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [patchSelected, redo, removeSelected, select, undo])

  const libraries = useMemo<LibrarySnapshot>(
    () => ({
      quotes: quotes.data ?? [],
      bibleTexts: bible.data ?? [],
      identities: (identities.data ?? []).map((item) => ({
        id: item.id,
        kind: item.kind,
        layout: item.layout,
        textShare: item.textShare,
        name: item.name,
        text: item.text,
        widthPx: item.widthPx,
        heightPx: item.heightPx,
      })),
      photos: (photos.data ?? []).map((photo) => ({
        id: photo.id,
        widthPx: photo.widthPx,
        heightPx: photo.heightPx,
      })),
    }),
    [quotes.data, bible.data, identities.data, photos.data],
  )

  const resolved = useMemo(() => {
    if (!draft) return null
    return resolveDocument(activeDocument(draft, side), libraries, mixSeed(draft.seed, 0))
  }, [draft, side, libraries])

  const selectedResolved = resolved?.elements.find((element) => element.id === selectedId) ?? null

  useEffect(() => {
    const node = viewportRef.current
    const current = useEditorStore.getState().draft
    if (!node || !current || fittedId.current === current.id) return
    const apply = () => {
      const box = node.getBoundingClientRect()
      if (box.width < 40 || box.height < 40) return
      const next = Math.min((box.width - 72) / current.widthMm, (box.height - 72) / current.heightMm)
      setPxPerMm(Math.max(0.6, next))
      fittedId.current = current.id
    }
    apply()
    const observer = new ResizeObserver(() => {
      if (fittedId.current === current.id) return
      apply()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [draft?.id])

  function fit() {
    const box = viewportRef.current?.getBoundingClientRect()
    if (!box || !draft) return
    const next = Math.min((box.width - 72) / draft.widthMm, (box.height - 72) / draft.heightMm)
    setPxPerMm(Math.max(0.6, next))
  }

  async function exportSide(which: "front" | "back", format: "png" | "pdf") {
    if (!draft || resolved?.broken) return
    setBusy(true)
    setExportError(null)
    try {
      const front = resolveDocument(draft.front, libraries, mixSeed(draft.seed, 0))
      const back =
        draft.sides === "double" ? resolveDocument(draft.back, libraries, mixSeed(draft.seed, 0)) : null
      if (format === "png") {
        const chosen = which === "front" ? front : back
        if (!chosen) return
        const png = await renderSidePng({
          side: chosen,
          widthMm: draft.widthMm,
          heightMm: draft.heightMm,
          dpi: 300,
          images,
        })
        downloadBlob(new Blob([pngBytes(png)]), `${slugify(draft.name)}-${which === "front" ? "frente" : "reverso"}.png`)
        return
      }
      const pages = [
        await pageFrom(front, draft.widthMm, draft.heightMm, images),
      ]
      if (back) pages.push(await pageFrom(back, draft.widthMm, draft.heightMm, images))
      const pdf = await buildPdf(pages)
      downloadBlob(new Blob([pngBytes(pdf)], { type: "application/pdf" }), `${slugify(draft.name)}.pdf`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "No se pudo exportar")
    } finally {
      setBusy(false)
    }
  }

  if (designQuery.isLoading) return <p className="p-8">Cargando diseño…</p>
  if (designQuery.error || !draft || !resolved) return <p className="p-8">No se encontró el diseño.</p>

  const statusLabel = {
    saved: "Guardado",
    saving: "Guardando…",
    dirty: "Cambios sin guardar",
    error: "No se pudo guardar",
  }[status]

  const zoom = Math.round((pxPerMm / SCREEN_PX_PER_MM) * 100)

  return (
    <div className="flex h-full min-h-screen flex-col bg-foam text-bark">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-bark px-4 py-3 text-mat">
        <div className="flex flex-wrap items-center gap-3">
          <Link to={`/projects/${projectId}`} className="text-sm text-paper hover:underline">
            Volver al proyecto
          </Link>
          <input
            aria-label="Nombre del diseño"
            value={draft.name}
            onFocus={beginGesture}
            onBlur={endGesture}
            onChange={(event) => live((design) => ({ ...design, name: event.target.value }))}
            className="w-48 border border-white/10 bg-bark-soft px-2 py-1 text-paper"
          />
          <label className="flex items-center gap-2 text-sm">
            Ancho
            <input
              className="w-20 bg-bark-soft px-2 py-1 text-paper"
              type="number"
              min={15}
              step={0.1}
              value={draft.widthMm}
              onChange={(event) => {
                const widthMm = Number(event.target.value)
                if (widthMm >= 15) commit((design) => ({ ...design, widthMm }))
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Alto
            <input
              className="w-20 bg-bark-soft px-2 py-1 text-paper"
              type="number"
              min={15}
              step={0.1}
              value={draft.heightMm}
              onChange={(event) => {
                const heightMm = Number(event.target.value)
                if (heightMm >= 15) commit((design) => ({ ...design, heightMm }))
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="paper"
            onClick={() => {
              const sides = draft.sides === "double" ? "single" : "double"
              commit((design) => ({ ...design, sides }))
              if (sides === "single") setSide("front")
            }}
          >
            {draft.sides === "double" ? "Dos caras" : "Una cara"}
          </Button>
          <div className="flex">
            <Button variant={side === "front" ? "solid" : "paper"} onClick={() => setSide("front")}>
              Frente
            </Button>
            <Button variant={side === "back" ? "solid" : "paper"} disabled={draft.sides === "single"} onClick={() => setSide("back")}>
              Reverso
            </Button>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={`text-sm ${status === "error" ? "text-mark" : "text-mat/70"}`}>{statusLabel}</span>
          <div className="relative">
            <Button variant="paper" aria-expanded={exportOpen} onClick={() => setExportOpen((value) => !value)}>
              Exportar
            </Button>
            {exportOpen ? (
              <div className="absolute right-0 z-20 mt-1 flex min-w-44 flex-col bg-bark-soft p-1">
                <Button variant="paper" disabled={busy || resolved.broken} onClick={() => void exportSide("front", "png")}>
                  Foto del frente
                </Button>
                <Button
                  variant="paper"
                  disabled={busy || resolved.broken || draft.sides === "single"}
                  onClick={() => void exportSide("back", "png")}
                >
                  Foto del reverso
                </Button>
              </div>
            ) : null}
          </div>
          <Button variant="solid" disabled={busy || resolved.broken} onClick={() => void exportSide("front", "pdf")}>
            PDF del marcapáginas
          </Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <ToolRail
          key={side}
          libraries={{
            photos: photos.data ?? [],
            groups: groups.data ?? [],
            quotes: quotes.data ?? [],
            quoteGroups: quoteGroups.data ?? [],
            bibleTexts: bible.data ?? [],
            bibleGroups: bibleGroups.data ?? [],
            identities: identities.data ?? [],
            identityGroups: identityGroups.data ?? [],
          }}
          onCreatePhoto={() => setDialog("photo")}
          onCreateQuote={() => setDialog("quote")}
          onCreateBible={() => setDialog("bible")}
          onCreateWordmark={() => setDialog("wordmark")}
          onCreateLogo={() => setDialog("logo")}
          onCreateLockup={() => setDialog("lockup")}
        />
        <div className="flex min-h-[70vh] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <Button variant="quiet" onClick={() => setPxPerMm((value) => value / 1.1)} aria-label="Alejar">
              −
            </Button>
            <span className="w-12 text-center text-sm">{zoom}%</span>
            <Button variant="quiet" onClick={() => setPxPerMm((value) => value * 1.1)} aria-label="Acercar">
              +
            </Button>
            <Button variant="quiet" onClick={fit}>
              Ajustar
            </Button>
            <Button variant="quiet" onClick={() => setPxPerMm(SCREEN_PX_PER_MM)}>
              100%
            </Button>
            <Button variant="quiet" onClick={toggleGuides}>
              {guides ? "Ocultar guías" : "Mostrar guías"}
            </Button>
            <Button variant="quiet" disabled={past.length === 0} onClick={undo}>
              Deshacer
            </Button>
            <Button variant="quiet" disabled={future.length === 0} onClick={redo}>
              Rehacer
            </Button>
            <label className="flex items-center gap-2 text-sm">
              Semilla
              <input
                className="w-24 border border-line bg-white px-2 py-1"
                type="number"
                value={draft.seed}
                onChange={(event) => commit((design) => ({ ...design, seed: Number(event.target.value) || 0 }))}
              />
            </label>
            <Button
              variant="paper"
              onClick={() => commit((design) => ({ ...design, seed: Math.floor(Math.random() * 1_000_000) + 1 }))}
            >
              Barajar
            </Button>
            <p className="basis-full text-sm text-bark/60 xl:basis-auto">Cambia los textos dinámicos de esta pieza.</p>
          </div>
          {resolved.broken ? (
            <p className="px-3 py-2 text-sm text-mark">Hay un elemento que apunta a algo que ya no está en la biblioteca.</p>
          ) : null}
          {exportError ? (
            <div className="px-3 py-2">
              <Notice>{exportError}</Notice>
            </div>
          ) : null}
          <div ref={viewportRef} className="cutting-mat min-h-0 flex-1 overflow-auto p-8">
            <BookmarkStage
              side={resolved}
              widthMm={draft.widthMm}
              heightMm={draft.heightMm}
              pxPerMm={pxPerMm}
              images={images}
              guides={guides}
              selectedId={selectedId}
              onSelect={select}
              onGestureStart={beginGesture}
              onCommitFrame={commitFrame}
            />
          </div>
        </div>
        <aside className="overflow-auto border-t border-line bg-white/60 px-4 py-4 xl:border-t-0 xl:border-l">
          <Properties
            libraries={{
              photos: photos.data ?? [],
              quotes: quotes.data ?? [],
              bibleTexts: bible.data ?? [],
              identities: identities.data ?? [],
            }}
            resolved={selectedResolved}
          />
        </aside>
      </div>
      {dialog ? <CreateDialog kind={dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  )
}

async function pageFrom(
  side: NonNullable<ReturnType<typeof resolveDocument>>,
  widthMm: number,
  heightMm: number,
  images: ReadonlyMap<string, HTMLImageElement>,
) {
  const png = await renderSidePng({ side, widthMm, heightMm, dpi: 300, images })
  return {
    widthMm,
    heightMm,
    images: [{ png, xMm: 0, yMm: 0, widthMm, heightMm }],
    cropMarks: [],
  }
}

function pngBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

function arrowDelta(key: string, step: number): { x: number; y: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { x: -step, y: 0 }
    case "ArrowRight":
      return { x: step, y: 0 }
    case "ArrowUp":
      return { x: 0, y: -step }
    case "ArrowDown":
      return { x: 0, y: step }
    default:
      return null
  }
}
