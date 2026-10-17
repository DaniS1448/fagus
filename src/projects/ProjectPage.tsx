import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { ApiError, apiGet, apiJson, downloadFile } from "../api"
import type { BibleText, Design, Identity, Photo, Project, Quote } from "../domain/models"
import type { LibrarySnapshot } from "../domain/resolve"
import { DEFAULT_HEIGHT_MM, DEFAULT_WIDTH_MM } from "../domain/units"
import { downloadBlob, slugify } from "../media"
import { Button, ButtonLink, EmptyState, Field, Notice, TextInput } from "../ui/controls"
import { PAGE_SIZE, usePagedList } from "../ui/page"
import { Pager } from "../ui/Pager"
import { TransferDialog, useTransfer } from "../ui/TransferDialog"
import { DesignThumb, thumbBox, useDesignImages } from "./DesignThumb"

export function ProjectPage() {
  const navigate = useNavigate()
  const { projectId = "" } = useParams()
  const queryClient = useQueryClient()
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiGet<Project>(`/api/projects/${projectId}`),
  })
  const designs = useQuery({
    queryKey: ["designs", projectId],
    queryFn: () => apiGet<Design[]>(`/api/projects/${projectId}/designs`),
  })
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: () => apiGet<Quote[]>("/api/quotes") })
  const bible = useQuery({ queryKey: ["bible"], queryFn: () => apiGet<BibleText[]>("/api/bible-texts") })
  const identities = useQuery({ queryKey: ["identities"], queryFn: () => apiGet<Identity[]>("/api/identities") })
  const photos = useQuery({ queryKey: ["photos"], queryFn: () => apiGet<Photo[]>("/api/photos") })
  const libraries = useMemo<LibrarySnapshot>(
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
  const images = useDesignImages(designs.data, identities.data)
  const [name, setName] = useState("Marcapáginas")
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH_MM)
  const [heightMm, setHeightMm] = useState(DEFAULT_HEIGHT_MM)
  const [sides, setSides] = useState<"single" | "double">("single")
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [projectName, setProjectName] = useState("")
  const { transfer, run, close } = useTransfer()
  const pagedDesigns = usePagedList(designs.data ?? [], PAGE_SIZE.designs, projectId)

  const rename = useMutation({
    mutationFn: () => apiJson<Project>(`/api/projects/${projectId}`, "PATCH", { name: projectName }),
    onSuccess: async () => {
      setEditing(false)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo renombrar"),
  })

  const create = useMutation({
    mutationFn: () =>
      apiJson<Design>(`/api/projects/${projectId}/designs`, "POST", { name, widthMm, heightMm, sides }),
    onSuccess: async (design) => {
      setError(null)
      pagedDesigns.setPage(1)
      await queryClient.invalidateQueries({ queryKey: ["designs", projectId] })
      navigate(`/projects/${projectId}/designs/${design.id}`)
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo crear el diseño"),
  })

  return (
    <div className="px-6 py-8 lg:px-10">
      <p className="text-sm text-bark/60">
        <Link to="/" className="hover:underline">
          Proyectos
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        {editing ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              rename.mutate()
            }}
          >
            <Field label="Nombre del proyecto">
              <TextInput value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </Field>
            <Button type="submit" disabled={rename.isPending || projectName.trim().length === 0}>
              Guardar nombre
            </Button>
            <Button variant="quiet" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl">{project.data?.name ?? "Proyecto"}</h1>
            <Button
              variant="quiet"
              onClick={() => {
                setProjectName(project.data?.name ?? "")
                setEditing(true)
              }}
            >
              Renombrar
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/projects/${projectId}/print`}>Componer pliego</ButtonLink>
          <Button
            variant="quiet"
            disabled={transfer !== null}
            onClick={() => {
              void run("Exportar proyecto", "preparing", "No se pudo exportar el proyecto", async (onProgress) => {
                const blob = await downloadFile(`/api/projects/${projectId}/export`, onProgress)
                downloadBlob(blob, `${slugify(project.data?.name ?? "proyecto")}.fagus`)
              })
            }}
          >
            Exportar proyecto
          </Button>
        </div>
      </div>
      {project.error ? <Notice>No se encontró el proyecto.</Notice> : null}
      {transfer ? (
        <TransferDialog
          title={transfer.title}
          phase={transfer.phase}
          loaded={transfer.loaded}
          total={transfer.total}
          error={transfer.error}
          onClose={close}
        />
      ) : null}
      <form
        className="mt-8 grid max-w-3xl gap-3 border border-line bg-white/60 p-4 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <Field label="Nuevo diseño">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Ancho (mm)">
          <TextInput
            type="number"
            min={15}
            step={0.1}
            value={widthMm}
            onChange={(event) => setWidthMm(Number(event.target.value))}
          />
        </Field>
        <Field label="Alto (mm)">
          <TextInput
            type="number"
            min={15}
            step={0.1}
            value={heightMm}
            onChange={(event) => setHeightMm(Number(event.target.value))}
          />
        </Field>
        <Field label="Caras">
          <select
            className="border border-line bg-white px-3 py-2 text-sm"
            value={sides}
            onChange={(event) => setSides(event.target.value === "double" ? "double" : "single")}
          >
            <option value="single">Una cara</option>
            <option value="double">Dos caras</option>
          </select>
        </Field>
        <div className="sm:col-span-4">
          <Button type="submit" disabled={create.isPending}>
            Crear diseño
          </Button>
          <p className="mt-2 text-sm text-bark/60">El tamaño de partida es 50 × 155 mm, un marcapáginas de 5 × 15,5 cm.</p>
        </div>
      </form>
      {error ? <div className="mt-3"><Notice>{error}</Notice></div> : null}
      <div className="mt-8">
        {designs.data && designs.data.length === 0 ? (
          <EmptyState title="Este proyecto todavía no tiene diseños">
            Crea uno y ábrelo para colocar la foto, el texto y la identidad.
          </EmptyState>
        ) : null}
        {designs.data && designs.data.length > 0 ? (
          <>
            <ul className="cutting-mat flex w-fit max-w-full flex-wrap items-end gap-x-4 gap-y-5 px-4 py-4">
              {pagedDesigns.items.map((design) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  projectId={projectId}
                  libraries={libraries}
                  images={images}
                />
              ))}
            </ul>
            <Pager page={pagedDesigns.page} pages={pagedDesigns.pages} onPage={pagedDesigns.setPage} />
          </>
        ) : null}
      </div>
    </div>
  )
}

function DesignCard({
  design,
  projectId,
  libraries,
  images,
}: {
  design: Design
  projectId: string
  libraries: LibrarySnapshot
  images: ReadonlyMap<string, HTMLImageElement>
}) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const duplicate = useMutation({
    mutationFn: () => apiJson<Design>(`/api/designs/${design.id}/duplicate`, "POST"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["designs", projectId] })
    },
  })
  const remove = useMutation({
    mutationFn: () => apiJson<void>(`/api/designs/${design.id}`, "DELETE"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["designs", projectId] })
    },
  })
  const face = thumbBox(design.widthMm, design.heightMm)
  const columnWidth = design.sides === "double" ? Math.max(148, face.width * 2 + 14) : 116
  const href = `/projects/${projectId}/designs/${design.id}`

  return (
    <li
      className="flex flex-col items-center text-center [content-visibility:auto]"
      style={{ width: columnWidth, containIntrinsicSize: `${columnWidth}px 232px` }}
    >
      <Link to={href} className="flex h-[10.5rem] items-end justify-center gap-1" aria-label={`Abrir ${design.name}`}>
        <DesignThumb
          side={design.front}
          widthMm={design.widthMm}
          heightMm={design.heightMm}
          seed={design.seed}
          libraries={libraries}
          images={images}
        />
        {design.sides === "double" ? (
          <DesignThumb
            side={design.back}
            widthMm={design.widthMm}
            heightMm={design.heightMm}
            seed={design.seed}
            libraries={libraries}
            images={images}
          />
        ) : null}
      </Link>
      <Link to={href} className="mt-2 w-full truncate text-sm" title={design.name}>
        {design.name}
      </Link>
      <p className="text-xs text-bark/60">
        {formatMm(design.widthMm)} × {formatMm(design.heightMm)} mm
        <br />
        {design.sides === "double" ? "Dos caras" : "Una cara"}
      </p>
      {confirming ? (
        <div className="mt-1 flex flex-col items-center gap-1">
          <span className="text-xs">¿Borrar «{design.name}»?</span>
          <span className="flex gap-2">
            <button
              type="button"
              className="text-xs text-mark disabled:opacity-40"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Borrar
            </button>
            <button type="button" className="text-xs" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </span>
        </div>
      ) : (
        <div className="mt-1 flex gap-2 text-xs">
          <button type="button" className="disabled:opacity-40" disabled={duplicate.isPending} onClick={() => duplicate.mutate()}>
            Duplicar
          </button>
          <button type="button" className="text-mark" onClick={() => setConfirming(true)}>
            Borrar
          </button>
        </div>
      )}
    </li>
  )
}

function formatMm(value: number): string {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(value)
}
