import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { apiGet, apiJson } from "../api"
import { parsedDesign } from "../domain/document"
import type { BibleText, Design, Identity, Photo, Project, Quote } from "../domain/models"
import type { FlipEdge } from "../domain/impose"
import type { Orientation, PaperName } from "../domain/units"
import { downloadBlob, slugify } from "../media"
import { Button, Field, Notice, Select } from "../ui/controls"
import { useLibraryImages } from "../editor/useLibraryImages"
import { planSheets, type PlannedSheet } from "./planSheets"
import { contentSize, renderSidePng, sheetsToPdf } from "./renderSide"

type PreviewCell = {
  url: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

type PreviewSheet = {
  key: string
  widthMm: number
  heightMm: number
  label: string
  cells: PreviewCell[]
  cropMarks: PlannedSheet["cropMarks"]
}

export function PrintPage() {
  const { projectId = "" } = useParams()
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiGet<Project>(`/api/projects/${projectId}`),
  })
  const designs = useQuery({
    queryKey: ["designs", projectId],
    queryFn: async () => (await apiGet<Design[]>(`/api/projects/${projectId}/designs`)).map(parsedDesign),
  })
  const photos = useQuery({ queryKey: ["photos"], queryFn: () => apiGet<Photo[]>("/api/photos") })
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: () => apiGet<Quote[]>("/api/quotes") })
  const bible = useQuery({ queryKey: ["bible"], queryFn: () => apiGet<BibleText[]>("/api/bible-texts") })
  const identities = useQuery({ queryKey: ["identities"], queryFn: () => apiGet<Identity[]>("/api/identities") })
  const images = useLibraryImages(photos.data, identities.data)
  const [copies, setCopies] = useState<Record<string, number>>({})
  const [paper, setPaper] = useState<PaperName>("A4")
  const [orientation, setOrientation] = useState<Orientation>("portrait")
  const [bookmarkOrientation, setBookmarkOrientation] = useState<Orientation>("portrait")
  const [marginMm, setMarginMm] = useState(10)
  const [gapMm, setGapMm] = useState(5)
  const [cropMarks, setCropMarks] = useState(true)
  const [flip, setFlip] = useState<FlipEdge>("long")
  const [duplex, setDuplex] = useState(true)
  const [previews, setPreviews] = useState<PreviewSheet[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [status, setStatus] = useState("")
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [columnWidth, setColumnWidth] = useState(640)

  useEffect(() => {
    if (!designs.data) return
    setCopies((current) => {
      const next = { ...current }
      for (const design of designs.data) {
        if (next[design.id] == null) next[design.id] = 1
      }
      return next
    })
  }, [designs.data])

  const libraries = useMemo(
    () => ({
      quotes: quotes.data ?? [],
      bibleTexts: bible.data ?? [],
      identities: (identities.data ?? []).map((item) => ({
        id: item.id,
        kind: item.kind,
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

  const jobs = (designs.data ?? []).map((design) => ({ design, copies: copies[design.id] ?? 0 }))
  const jobsKey = JSON.stringify(jobs.map((job) => [job.design.updatedAt, job.design.id, job.copies, job.design.seed]))

  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    const timer = window.setTimeout(() => {
      void (async () => {
        const planned = planSheets(jobs, libraries, {
          paper,
          orientation,
          bookmarkOrientation,
          marginMm,
          gapMm,
          cropMarks,
          flip,
          duplex,
        })
        if (cancelled) return
        setNotes(planned.notes)
        if (planned.sheets.length === 0) {
          setPreviews([])
          setStatus("")
          return
        }
        setStatus("Preparando la vista…")
        const next: PreviewSheet[] = []
        for (const [index, sheet] of planned.sheets.entries()) {
          const cells: PreviewCell[] = []
          for (const cell of sheet.cells) {
            const content = contentSize(cell)
            const png = await renderSidePng({
              side: cell.resolved,
              widthMm: content.widthMm,
              heightMm: content.heightMm,
              rotation: cell.rotation,
              dpi: 110,
              images,
            })
            const url = URL.createObjectURL(new Blob([toBuffer(png)], { type: "image/png" }))
            urls.push(url)
            cells.push({
              url,
              xMm: cell.xMm,
              yMm: cell.yMm,
              widthMm: cell.widthMm,
              heightMm: cell.heightMm,
            })
            if (cancelled) return
          }
          next.push({
            key: `${index}-${sheet.side}`,
            widthMm: sheet.widthMm,
            heightMm: sheet.heightMm,
            label: `${paper} · ${sheet.sizeLabel} · ${sheet.side === "front" ? "Frente" : "Reverso"}`,
            cells,
            cropMarks: sheet.cropMarks,
          })
        }
        if (cancelled) return
        setPreviews(next)
        setStatus("")
      })().catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo preparar la vista")
      })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      for (const url of urls) URL.revokeObjectURL(url)
    }
    // jobs is rebuilt each render; jobsKey captures the values that should refresh the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsKey, libraries, images, paper, orientation, bookmarkOrientation, marginMm, gapMm, cropMarks, flip, duplex])

  async function downloadPdf() {
    setError(null)
    setStatus("Preparando el PDF…")
    try {
      const planned = planSheets(jobs, libraries, {
        paper,
        orientation,
        bookmarkOrientation,
        marginMm,
        gapMm,
        cropMarks,
        flip,
        duplex,
      })
      if (planned.sheets.length === 0) {
        setError(planned.notes[0] ?? "No hay copias para imprimir")
        setStatus("")
        return
      }
      const pdf = await sheetsToPdf(planned.sheets, images, 300)
      downloadBlob(new Blob([toBuffer(pdf)], { type: "application/pdf" }), `${slugify(project.data?.name ?? "pliego")}-${paper.toLowerCase()}.pdf`)
      setStatus("PDF descargado")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el PDF")
      setStatus("")
    }
  }

  async function shuffle(design: Design) {
    const seed = Math.floor(Math.random() * 1_000_000) + 1
    await apiJson(`/api/designs/${design.id}`, "PATCH", { seed })
    await designs.refetch()
  }

  useEffect(() => {
    const node = previewRef.current
    if (!node) return
    const observer = new ResizeObserver(() => setColumnWidth(node.clientWidth))
    observer.observe(node)
    setColumnWidth(node.clientWidth)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="px-6 py-8 lg:px-10">
      <p className="text-sm text-bark/60">
        <Link to={`/projects/${projectId}`} className="hover:underline">
          {project.data?.name ?? "Proyecto"}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl">Pliego</h1>
      <p className="mt-2 max-w-2xl text-bark/70">
        Cada copia de un texto dinámico puede salir distinta. El reverso se coloca detrás de su frente.
      </p>
      <div className="mt-8 grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {designs.data?.map((design) => (
              <li key={design.id} className="border border-line bg-white/70 p-3">
                <p>{design.name}</p>
                <p className="text-sm text-bark/60">
                  {design.widthMm} × {design.heightMm} mm · semilla {design.seed}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-sm">
                    Copias
                    <input
                      className="ml-2 w-16 border border-line px-2 py-1"
                      type="number"
                      min={0}
                      value={copies[design.id] ?? 0}
                      onChange={(event) =>
                        setCopies((current) => ({ ...current, [design.id]: Math.max(0, Number(event.target.value) || 0) }))
                      }
                    />
                  </label>
                  <Button variant="quiet" onClick={() => void shuffle(design)}>
                    Barajar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Field label="Papel">
            <Select value={paper} onChange={(event) => setPaper(event.target.value === "A3" ? "A3" : "A4")}>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </Select>
          </Field>
          <Field label="Orientación del papel">
            <Select
              value={orientation}
              onChange={(event) => setOrientation(event.target.value === "landscape" ? "landscape" : "portrait")}
            >
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
            </Select>
          </Field>
          <Field label="Orientación del marcapáginas">
            <Select
              value={bookmarkOrientation}
              onChange={(event) => setBookmarkOrientation(event.target.value === "landscape" ? "landscape" : "portrait")}
            >
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
            </Select>
          </Field>
          <Field label="Margen mínimo (mm)">
            <input className="border border-line bg-white px-3 py-2" type="number" min={0} value={marginMm} onChange={(event) => setMarginMm(Number(event.target.value))} />
          </Field>
          <Field label="Separación (mm)">
            <input className="border border-line bg-white px-3 py-2" type="number" min={0} value={gapMm} onChange={(event) => setGapMm(Number(event.target.value))} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cropMarks} onChange={(event) => setCropMarks(event.target.checked)} />
            Marcas de corte
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={duplex} onChange={(event) => setDuplex(event.target.checked)} />
            Incluir reverso
          </label>
          {duplex ? (
            <Field label="Volteo">
              <Select value={flip} onChange={(event) => setFlip(event.target.value === "short" ? "short" : "long")}>
                <option value="long">Borde largo</option>
                <option value="short">Borde corto</option>
              </Select>
            </Field>
          ) : null}
          <Button onClick={() => void downloadPdf()}>Descargar PDF del pliego</Button>
          {status ? <p className="text-sm">{status}</p> : null}
          {error ? <Notice>{error}</Notice> : null}
          {notes.map((note) => (
            <Notice key={note}>{note}</Notice>
          ))}
        </div>
        <div ref={previewRef} className="flex min-w-0 flex-col gap-8 overflow-auto">
          <div className="hidden xl:block">
            <Button onClick={() => void downloadPdf()}>Descargar PDF del pliego</Button>
          </div>
          {previews.length === 0 && !status ? (
            <p className="text-sm text-bark/70">
              {jobs.some((job) => job.copies > 0) ? "Preparando la vista…" : "Indica cuántas copias quieres de cada diseño."}
            </p>
          ) : null}
          {previews.map((sheet) => {
            const display = Math.max(0.4, columnWidth / sheet.widthMm)
            return (
            <figure key={sheet.key}>
              <figcaption className="mb-2 text-sm">{sheet.label}</figcaption>
              <div
                className="relative bg-white shadow"
                style={{ width: sheet.widthMm * display, height: sheet.heightMm * display }}
              >
                {sheet.cells.map((cell) => (
                  <img
                    key={cell.url}
                    src={cell.url}
                    alt=""
                    className="absolute"
                    style={{
                      left: cell.xMm * display,
                      top: cell.yMm * display,
                      width: cell.widthMm * display,
                      height: cell.heightMm * display,
                    }}
                  />
                ))}
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`}>
                  {sheet.cropMarks.map((mark, index) => (
                    <line
                      key={`${mark.x1}-${mark.y1}-${index}`}
                      x1={mark.x1}
                      y1={mark.y1}
                      x2={mark.x2}
                      y2={mark.y2}
                      stroke="#8F2D2D"
                      strokeWidth={0.35}
                    />
                  ))}
                </svg>
              </div>
            </figure>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
