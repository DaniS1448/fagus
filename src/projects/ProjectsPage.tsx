import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router"
import { ApiError, apiGet, apiJson } from "../api"
import type { Project } from "../domain/models"
import { Button, EmptyState, Field, Notice, TextInput } from "../ui/controls"

export function ProjectsPage() {
  const queryClient = useQueryClient()
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => apiGet<Project[]>("/api/projects") })
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => apiJson<Project>("/api/projects", "POST", { name }),
    onSuccess: async () => {
      setName("")
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo crear"),
  })

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="text-3xl">Proyectos</h1>
      <p className="mt-2 max-w-xl text-bark/70">
        Cada proyecto reúne los marcapáginas de un encargo. Las citas, los textos y las fotos viven en las bibliotecas y se reutilizan.
      </p>
      <form
        className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <Field label="Nuevo proyecto">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Campamento Emaus" />
        </Field>
        <Button type="submit" disabled={create.isPending || name.trim().length === 0}>
          Crear proyecto
        </Button>
      </form>
      {error ? <div className="mt-3"><Notice>{error}</Notice></div> : null}
      <div className="mt-10">
        {projects.isLoading ? <p>Cargando proyectos…</p> : null}
        {projects.error ? <Notice>No se pudieron cargar los proyectos.</Notice> : null}
        {projects.data && projects.data.length === 0 ? (
          <EmptyState title="Todavía no hay proyectos">
            Crea el primero para empezar a diseñar marcapáginas.
          </EmptyState>
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(project.name)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rename = useMutation({
    mutationFn: () => apiJson<Project>(`/api/projects/${project.id}`, "PATCH", { name }),
    onSuccess: async () => {
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo renombrar"),
  })

  const remove = useMutation({
    mutationFn: () => apiJson<void>(`/api/projects/${project.id}`, "DELETE"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })

  return (
    <li className="flex flex-col gap-4 border border-line bg-white/70 p-4">
      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            rename.mutate()
          }}
        >
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          <div className="flex gap-2">
            <Button type="submit">Guardar nombre</Button>
            <Button variant="quiet" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Link to={`/projects/${project.id}`} className="text-xl hover:underline">
          {project.name}
        </Link>
      )}
      {error ? <Notice>{error}</Notice> : null}
      <div className="mt-auto flex gap-2">
        <Button variant="quiet" onClick={() => setEditing(true)}>
          Renombrar
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm(`¿Borrar el proyecto «${project.name}» y todos sus diseños?`)) remove.mutate()
          }}
        >
          Borrar
        </Button>
      </div>
    </li>
  )
}
