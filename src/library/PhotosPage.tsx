import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { ApiError, apiGet, apiJson } from "../api"
import type { Photo, PhotoGroup } from "../domain/models"
import { Button, ConfirmButton, EmptyState, Field, Notice, Select, TextInput } from "../ui/controls"
import { uploadPhotos } from "./uploadPhotos"

type Filter = "all" | "none" | string

export function PhotosPage() {
  const queryClient = useQueryClient()
  const photos = useQuery({ queryKey: ["photos"], queryFn: () => apiGet<Photo[]>("/api/photos") })
  const groups = useQuery({ queryKey: ["photo-groups"], queryFn: () => apiGet<PhotoGroup[]>("/api/photo-groups") })
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<string[]>([])
  const [moveTarget, setMoveTarget] = useState("none")
  const [progress, setProgress] = useState<string | null>(null)
  const [failures, setFailures] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [groupName, setGroupName] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const visible = (photos.data ?? []).filter((photo) => {
    if (filter === "all") return true
    if (filter === "none") return photo.groupId == null
    return photo.groupId === filter
  })
  const activeGroup = groups.data?.find((group) => group.id === filter) ?? null
  const chosen = photos.data?.filter((photo) => selected.includes(photo.id)) ?? []
  const single = chosen.length === 1 ? chosen[0] : null

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["photos"] }),
      queryClient.invalidateQueries({ queryKey: ["photo-groups"] }),
    ])
  }

  const createGroup = useMutation({
    mutationFn: () => apiJson<PhotoGroup>("/api/photo-groups", "POST", { name: groupName }),
    onSuccess: async (group) => {
      setGroupName("")
      setCreating(false)
      setFilter(group.id)
      setError(null)
      await refresh()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo crear la agrupación"),
  })

  const renameGroup = useMutation({
    mutationFn: (name: string) => apiJson<PhotoGroup>(`/api/photo-groups/${filter}`, "PATCH", { name }),
    onSuccess: async () => {
      setError(null)
      await refresh()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo renombrar"),
  })

  const dissolve = useMutation({
    mutationFn: () => apiJson<void>(`/api/photo-groups/${filter}`, "DELETE"),
    onSuccess: async () => {
      setFilter("none")
      setError(null)
      await refresh()
    },
  })

  const move = useMutation({
    mutationFn: () =>
      apiJson<void>("/api/photos/bulk", "POST", {
        ids: selected,
        op: "move",
        groupId: moveTarget === "none" ? null : moveTarget,
      }),
    onSuccess: async () => {
      setSelected([])
      setError(null)
      await refresh()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudieron mover"),
  })

  const remove = useMutation({
    mutationFn: () => apiJson<void>("/api/photos/bulk", "POST", { ids: selected, op: "delete" }),
    onSuccess: async () => {
      setSelected([])
      setError(null)
      await refresh()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudieron borrar"),
  })

  const destination = filter !== "all" && filter !== "none" ? filter : null

  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="px-6 py-8 lg:px-10">
        <h1 className="text-3xl">Fotos</h1>
        <p className="mt-2 max-w-xl text-bark/70">
          Cada foto entra en un cajón o se queda sin agrupar. En el diseño se encaja dentro de un marco.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <DrawerButton pressed={filter === "all"} onClick={() => setFilter("all")}>
            Todas
          </DrawerButton>
          <DrawerButton pressed={filter === "none"} onClick={() => setFilter("none")}>
            Sin agrupar
          </DrawerButton>
          {groups.data?.map((group) => (
            <DrawerButton key={group.id} pressed={filter === group.id} onClick={() => setFilter(group.id)}>
              {group.name}
            </DrawerButton>
          ))}
          <Button variant="quiet" onClick={() => setCreating(true)}>
            Nueva agrupación
          </Button>
        </div>
        {creating ? (
          <form
            className="mt-3 flex max-w-md flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              createGroup.mutate()
            }}
          >
            <Field label="Nombre del cajón">
              <TextInput value={groupName} onChange={(event) => setGroupName(event.target.value)} />
            </Field>
            <Button type="submit" disabled={groupName.trim().length === 0 || createGroup.isPending}>
              Crear agrupación
            </Button>
            <Button variant="quiet" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </form>
        ) : null}
        {activeGroup ? (
          <GroupName
            key={activeGroup.id}
            group={activeGroup}
            onRename={(name) => renameGroup.mutate(name)}
            onDissolve={() => dissolve.mutate()}
            pending={dissolve.isPending}
          />
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={progress != null}>
            Subir fotos
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])]
              event.target.value = ""
              if (files.length === 0) return
              setFailures([])
              setError(null)
              void uploadPhotos(files, destination, (done, total) => setProgress(`${done} de ${total}`)).then(async (failed) => {
                setProgress(null)
                setFailures(failed)
                await refresh()
              })
            }}
          />
          {visible.length > 0 ? (
            <Button variant="quiet" onClick={() => setSelected(visible.map((photo) => photo.id))}>
              Seleccionar estas
            </Button>
          ) : null}
          {selected.length > 0 ? (
            <Button variant="quiet" onClick={() => setSelected([])}>
              Quitar selección
            </Button>
          ) : null}
          {progress ? <p className="text-sm">Subiendo {progress}</p> : null}
        </div>
        {selected.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-end gap-2 border border-line bg-white/70 p-3">
            <p className="pb-2 text-sm">
              {selected.length === 1 ? "1 seleccionada" : `${selected.length} seleccionadas`}
            </p>
            <Field label="Mover a">
              <Select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
                <option value="none">Sin agrupar</option>
                {groups.data?.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="quiet" disabled={move.isPending} onClick={() => move.mutate()}>
              Mover
            </Button>
            <ConfirmButton
              label="Borrar"
              question={selected.length === 1 ? "¿Borrar 1 foto?" : `¿Borrar ${selected.length} fotos?`}
              pending={remove.isPending}
              onConfirm={() => remove.mutate()}
            />
          </div>
        ) : null}
        {error ? <div className="mt-3"><Notice>{error}</Notice></div> : null}
        {failures.length > 0 ? (
          <div className="mt-3">
            <Notice>No cupieron: {failures.join(", ")}. El límite es 20 MB por archivo.</Notice>
          </div>
        ) : null}
        {photos.data && visible.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="Este cajón está vacío">Sube fotos JPEG, PNG o WebP. Cada archivo puede pesar hasta 20 MB.</EmptyState>
          </div>
        ) : null}
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((photo) => {
            const on = selected.includes(photo.id)
            return (
              <li key={photo.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(photo.id)}
                  className={`w-full border bg-paper p-2 text-left ${on ? "border-ink" : "border-line"}`}
                >
                  <img src={`/api/photos/${photo.id}/thumbnail`} alt="" className="aspect-[3/4] w-full object-cover" />
                  <span className="mt-2 block text-sm">{photo.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <aside className="border-t border-line bg-white/50 px-6 py-8 lg:border-t-0 lg:border-l">
        {single ? (
          <PhotoDetail key={single.id} photo={single} groups={groups.data ?? []} onSaved={() => void refresh()} />
        ) : (
          <p className="text-sm text-bark/70">Selecciona una foto para cambiarle el nombre o moverla de cajón.</p>
        )}
      </aside>
    </div>
  )
}

function DrawerButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`px-3 py-2 text-sm ${pressed ? "bg-ink text-paper" : "border border-line bg-white/70"}`}
    >
      {children}
    </button>
  )
}

function GroupName({
  group,
  onRename,
  onDissolve,
  pending,
}: {
  group: PhotoGroup
  onRename: (name: string) => void
  onDissolve: () => void
  pending: boolean
}) {
  const [name, setName] = useState(group.name)
  return (
    <form
      className="mt-4 flex max-w-xl flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        onRename(name)
      }}
    >
      <Field label="Nombre del cajón">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Button type="submit" variant="quiet" disabled={name.trim().length === 0 || name === group.name}>
        Guardar nombre
      </Button>
      <ConfirmButton label="Disolver" question="Las fotos pasan a Sin agrupar." pending={pending} onConfirm={onDissolve} />
    </form>
  )
}

function PhotoDetail({ photo, groups, onSaved }: { photo: Photo; groups: PhotoGroup[]; onSaved: () => void }) {
  const [name, setName] = useState(photo.name)
  const [groupId, setGroupId] = useState(photo.groupId ?? "none")
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      apiJson<Photo>(`/api/photos/${photo.id}`, "PATCH", {
        name,
        groupId: groupId === "none" ? null : groupId,
      }),
    onSuccess: () => {
      setError(null)
      onSaved()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <h2 className="text-xl">Foto</h2>
      <img src={`/api/photos/${photo.id}/file`} alt="" className="max-h-64 object-contain" />
      <Field label="Nombre">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Cajón">
        <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          <option value="none">Sin agrupar</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </Field>
      {error ? <Notice>{error}</Notice> : null}
      <Button type="submit" disabled={save.isPending}>
        Guardar foto
      </Button>
    </form>
  )
}
