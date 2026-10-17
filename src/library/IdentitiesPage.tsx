import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiError, apiForm, apiGet, apiJson } from "../api"
import type { Identity } from "../domain/models"
import { imageForm, prepareImage } from "../media"
import { Button, ConfirmButton, EmptyState, Field, Notice, TextInput } from "../ui/controls"
import { LibraryScreen } from "./LibraryScreen"

export function IdentitiesPage() {
  const queryClient = useQueryClient()
  const identities = useQuery({
    queryKey: ["identities"],
    queryFn: () => apiGet<Identity[]>("/api/identities"),
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [kind, setKind] = useState<"wordmark" | "logo">("wordmark")
  const [name, setName] = useState("")
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selected = identities.data?.find((item) => item.id === selectedId) ?? null

  function beginWordmark() {
    setSelectedId(null)
    setKind("wordmark")
    setName("")
    setText("")
    setFile(null)
    setError(null)
  }

  function beginLogo() {
    setSelectedId(null)
    setKind("logo")
    setName("")
    setText("")
    setFile(null)
    setError(null)
  }

  function beginEdit(item: Identity) {
    setSelectedId(item.id)
    setKind(item.kind)
    setName(item.name)
    setText(item.text)
    setFile(null)
    setError(null)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (kind === "wordmark") {
        const payload = { kind: "wordmark" as const, name, text }
        return selected
          ? apiJson<Identity>(`/api/identities/${selected.id}`, "PATCH", payload)
          : apiJson<Identity>("/api/identities", "POST", payload)
      }
      if (!file && !selected) throw new ApiError("Elige el archivo del logo")
      if (!file && selected) {
        return apiJson<Identity>(`/api/identities/${selected.id}`, "PATCH", { name })
      }
      if (!file) throw new ApiError("Elige el archivo del logo")
      const prepared = await prepareImage(file)
      const body = imageForm(prepared, name || file.name)
      return selected
        ? apiForm<Identity>(`/api/identities/${selected.id}`, "PATCH", body)
        : apiForm<Identity>("/api/identities", "POST", body)
    },
    onSuccess: async (item) => {
      setSelectedId(item.id)
      setFile(null)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["identities"] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiJson<void>(`/api/identities/${id}`, "DELETE"),
    onSuccess: async () => {
      beginWordmark()
      await queryClient.invalidateQueries({ queryKey: ["identities"] })
    },
  })

  return (
    <LibraryScreen
      title="Identidad"
      lede="Títulos cortos y logos de la iglesia. No entran en el sorteo: en el diseño se eligen y se quedan fijos."
      list={
        <>
          <div className="flex gap-2">
            <Button variant="quiet" onClick={beginWordmark}>
              Nuevo título
            </Button>
            <Button variant="quiet" onClick={beginLogo}>
              Nuevo logo
            </Button>
          </div>
          {identities.data && identities.data.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="Todavía no hay identidad">
                Añade un título como «Emaus 2027» o el logo en PNG.
              </EmptyState>
            </div>
          ) : null}
          <ul className="mt-4 flex flex-col gap-2">
            {identities.data?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => beginEdit(item)}
                  className={`flex w-full items-center gap-3 border px-4 py-3 text-left ${item.id === selectedId ? "border-ink bg-white" : "border-line bg-white/40"}`}
                >
                  {item.kind === "logo" ? (
                    <img src={`/api/identities/${item.id}/thumbnail`} alt="" className="h-10 w-10 object-contain" />
                  ) : (
                    <span className="font-[family-name:var(--font-sans)] text-sm">{item.text}</span>
                  )}
                  <span>
                    <span className="block">{item.name}</span>
                    <span className="text-sm text-bark/60">{item.kind === "logo" ? "Logo" : "Título"}</span>
                  </span>
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
          <h2 className="text-xl">{selected ? "Editar identidad" : kind === "logo" ? "Nuevo logo" : "Nuevo título"}</h2>
          <Field label="Nombre en la biblioteca">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Emaus 2027" />
          </Field>
          {kind === "wordmark" ? (
            <Field label="Título en el marcapáginas">
              <TextInput
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Iglesia Adventista Emaus 2027"
              />
            </Field>
          ) : (
            <Field label={selected ? "Sustituir archivo" : "Archivo"}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>
          )}
          {selected?.kind === "logo" ? (
            <img src={`/api/identities/${selected.id}/file`} alt="" className="max-h-40 object-contain" />
          ) : null}
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              Guardar identidad
            </Button>
            {selected ? (
              <ConfirmButton
                label="Borrar"
                question="¿Borrar este elemento de identidad?"
                pending={remove.isPending}
                onConfirm={() => remove.mutate(selected.id)}
              />
            ) : null}
          </div>
        </form>
      }
    />
  )
}
