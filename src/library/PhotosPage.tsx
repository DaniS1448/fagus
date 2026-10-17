import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiError, apiForm, apiGet, apiJson } from "../api"
import type { Photo } from "../domain/models"
import { imageForm, prepareImage } from "../media"
import { Button, EmptyState, Field, Notice, TextInput } from "../ui/controls"
import { LibraryScreen } from "./LibraryScreen"

export function PhotosPage() {
  const queryClient = useQueryClient()
  const photos = useQuery({ queryKey: ["photos"], queryFn: () => apiGet<Photo[]>("/api/photos") })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selected = photos.data?.find((photo) => photo.id === selectedId) ?? null

  function beginCreate() {
    setSelectedId(null)
    setName("")
    setFile(null)
    setError(null)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (selected && !file) return apiJson<Photo>(`/api/photos/${selected.id}`, "PATCH", { name })
      if (!file) throw new ApiError("Elige una foto")
      const prepared = await prepareImage(file)
      return apiForm<Photo>("/api/photos", "POST", imageForm(prepared, name || file.name.replace(/\.[^.]+$/, "")))
    },
    onSuccess: async (photo) => {
      setSelectedId(photo.id)
      setName(photo.name)
      setFile(null)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["photos"] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiJson<void>(`/api/photos/${id}`, "DELETE"),
    onSuccess: async () => {
      beginCreate()
      await queryClient.invalidateQueries({ queryKey: ["photos"] })
    },
  })

  return (
    <LibraryScreen
      title="Fotos"
      lede="Se guardan dentro de la base de datos local. En el diseño se encajan dentro de un marco: puedes rellenar, contener, acercar y desplazar."
      list={
        <>
          <Button variant="quiet" onClick={beginCreate}>
            Subir foto
          </Button>
          {photos.data && photos.data.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="No hay fotos">Sube la primera desde el panel de la derecha. El límite es 20 MB.</EmptyState>
            </div>
          ) : null}
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.data?.map((photo) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(photo.id)
                    setName(photo.name)
                    setFile(null)
                    setError(null)
                  }}
                  className={`w-full border bg-paper p-2 text-left ${photo.id === selectedId ? "border-ink" : "border-line"}`}
                >
                  <img src={`/api/photos/${photo.id}/thumbnail`} alt="" className="aspect-[3/4] w-full object-cover" />
                  <span className="mt-2 block text-sm">{photo.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      }
      form={
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <h2 className="text-xl">{selected ? "Editar foto" : "Subir foto"}</h2>
          <Field label="Nombre">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          {selected ? null : (
            <Field label="Archivo">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>
          )}
          {selected ? <img src={`/api/photos/${selected.id}/file`} alt="" className="max-h-64 object-contain" /> : null}
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {selected ? "Guardar nombre" : "Subir foto"}
            </Button>
            {selected ? (
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm("¿Borrar esta foto?")) remove.mutate(selected.id)
                }}
              >
                Borrar
              </Button>
            ) : null}
          </div>
        </form>
      }
    />
  )
}
