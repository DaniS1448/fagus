import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { ApiError, apiGet, apiJson } from "../api"
import type { Design, Project } from "../domain/models"
import { DEFAULT_HEIGHT_MM, DEFAULT_WIDTH_MM } from "../domain/units"
import { downloadBlob, slugify } from "../media"
import { Button, ButtonLink, ConfirmButton, EmptyState, Field, Notice, TextInput } from "../ui/controls"

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
  const [name, setName] = useState("Marcapáginas")
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH_MM)
  const [heightMm, setHeightMm] = useState(DEFAULT_HEIGHT_MM)
  const [sides, setSides] = useState<"single" | "double">("single")
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () =>
      apiJson<Design>(`/api/projects/${projectId}/designs`, "POST", { name, widthMm, heightMm, sides }),
    onSuccess: async (design) => {
      setError(null)
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
        <h1 className="text-3xl">{project.data?.name ?? "Proyecto"}</h1>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/projects/${projectId}/print`}>Componer pliego</ButtonLink>
          <Button
            variant="quiet"
            onClick={() => {
              void fetch(`/api/projects/${projectId}/export`)
                .then(async (response) => {
                  if (!response.ok) throw new Error("No se pudo exportar")
                  const blob = await response.blob()
                  downloadBlob(blob, `${slugify(project.data?.name ?? "proyecto")}.fagus`)
                })
                .catch(() => setError("No se pudo exportar el proyecto"))
            }}
          >
            Exportar proyecto
          </Button>
        </div>
      </div>
      {project.error ? <Notice>No se encontró el proyecto.</Notice> : null}
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
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {designs.data?.map((design) => (
            <DesignCard key={design.id} design={design} projectId={projectId} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function DesignCard({ design, projectId }: { design: Design; projectId: string }) {
  const queryClient = useQueryClient()
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
  const ratio = design.heightMm / design.widthMm

  return (
    <li className="flex flex-col gap-4 border border-line bg-white/70 p-4">
      <div className="flex items-start gap-4">
        <div
          className="w-10 shrink-0 bg-paper shadow"
          style={{ height: `${Math.min(120, 40 * ratio)}px` }}
          aria-hidden
        />
        <div>
        <Link to={`/projects/${projectId}/designs/${design.id}`} className="text-lg">
          {design.name}
        </Link>
          <p className="text-sm text-bark/60">
            {formatMm(design.widthMm)} × {formatMm(design.heightMm)} mm · {design.sides === "double" ? "Dos caras" : "Una cara"}
          </p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <ButtonLink to={`/projects/${projectId}/designs/${design.id}`}>Abrir editor</ButtonLink>
        <Button variant="quiet" onClick={() => duplicate.mutate()}>
          Duplicar
        </Button>
        <ConfirmButton
          label="Borrar"
          question={`¿Borrar «${design.name}»?`}
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </div>
    </li>
  )
}

function formatMm(value: number): string {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(value)
}
