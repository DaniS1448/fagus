import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiError, apiForm, apiGet, apiJson } from "../api"
import type { Identity } from "../domain/models"
import { imageForm, prepareImage } from "../media"
import { Button, ConfirmButton, EmptyState, Field, Notice, TextInput } from "../ui/controls"
import { PAGE_SIZE, usePagedList } from "../ui/page"
import { Pager } from "../ui/Pager"
import { GroupField, GroupShelf, SelectionStrip, inDrawer, openGroupId, type DrawerFilter } from "./groups"
import { LibraryListTools } from "./listTools"
import { LibraryScreen } from "./LibraryScreen"
import { LibraryTransfer } from "./LibraryTransfer"
import { filterByQuery, listResetKey } from "./search"

type IdentityDraft = { kind: "wordmark" | "logo"; name: string; text: string; groupId: string }

export function IdentitiesPage() {
  const queryClient = useQueryClient()
  const identities = useQuery({ queryKey: ["identities"], queryFn: () => apiGet<Identity[]>("/api/identities") })
  const [filter, setFilter] = useState<DrawerFilter>("all")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState<"wordmark" | "logo" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const visible = inDrawer(identities.data ?? [], filter)
  const matches = filterByQuery(visible, query, (item) => `${item.name} ${item.text} ${item.kind === "logo" ? "logo" : "título"}`)
  const paged = usePagedList(matches, PAGE_SIZE.library, listResetKey(filter, query))
  const chosen = (identities.data ?? []).filter((item) => selected.includes(item.id))
  const single = chosen.length === 1 ? chosen[0] : null
  const mode = single?.kind ?? creating ?? "wordmark"

  function toggle(id: string) {
    setCreating(null)
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
    setError(null)
  }

  function begin(kind: "wordmark" | "logo") {
    setSelected([])
    setCreating(kind)
    setError(null)
  }

  const save = useMutation({
    mutationFn: async (input: { draft: IdentityDraft; file: File | null }) => {
      const groupId = input.draft.groupId === "none" ? null : input.draft.groupId
      if (input.draft.kind === "wordmark") {
        const payload = { kind: "wordmark" as const, name: input.draft.name, text: input.draft.text, groupId }
        return single
          ? apiJson<Identity>(`/api/identities/${single.id}`, "PATCH", payload)
          : apiJson<Identity>("/api/identities", "POST", payload)
      }
      if (!input.file && !single) throw new ApiError("Elige el archivo del logo")
      if (!input.file && single) {
        return apiJson<Identity>(`/api/identities/${single.id}`, "PATCH", { name: input.draft.name, groupId })
      }
      if (!input.file) throw new ApiError("Elige el archivo del logo")
      const prepared = await prepareImage(input.file)
      const body = imageForm(prepared, input.draft.name || input.file.name, groupId ?? undefined)
      return single
        ? apiForm<Identity>(`/api/identities/${single.id}`, "PATCH", body)
        : apiForm<Identity>("/api/identities", "POST", body)
    },
    onSuccess: async (item) => {
      setCreating(null)
      setSelected([item.id])
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["identities"] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiJson<void>(`/api/identities/${id}`, "DELETE"),
    onSuccess: async () => {
      setSelected([])
      setCreating("wordmark")
      await queryClient.invalidateQueries({ queryKey: ["identities"] })
    },
  })

  const initial: IdentityDraft = single
    ? { kind: single.kind, name: single.name, text: single.text, groupId: single.groupId ?? "none" }
    : { kind: mode, name: "", text: "", groupId: openGroupId(filter) ?? "none" }

  return (
    <LibraryScreen
      title="Identidad"
      lede="Títulos cortos y logos de la iglesia. No entran en el sorteo: en el diseño se eligen y se quedan fijos."
      actions={<LibraryTransfer scope="identities" />}
      list={
        <>
          <GroupShelf
            kind="identities"
            filter={filter}
            onFilter={setFilter}
            dissolveCopy="Los elementos pasan a Sin agrupar."
          />
          <div className="mt-6 flex gap-2">
            <Button variant="quiet" onClick={() => begin("wordmark")}>
              Nuevo título
            </Button>
            <Button variant="quiet" onClick={() => begin("logo")}>
              Nuevo logo
            </Button>
          </div>
          {visible.length > 0 || query.trim().length > 0 ? (
            <LibraryListTools
              query={query}
              onQuery={setQuery}
              matchIds={matches.map((item) => item.id)}
              pageIds={paged.items.map((item) => item.id)}
              selectedIds={selected}
              onSelect={setSelected}
            />
          ) : null}
          <SelectionStrip
            kind="identities"
            ids={selected}
            noun={{ one: "elemento", many: "elementos" }}
            onDone={() => {
              setSelected([])
              void queryClient.invalidateQueries({ queryKey: ["identities"] })
            }}
          />
          {identities.data && visible.length === 0 && query.trim().length === 0 ? (
            <div className="mt-6">
              <EmptyState title="Este cajón está vacío">Añade un título como «Emaus 2027» o el logo en PNG.</EmptyState>
            </div>
          ) : null}
          <ul className="mt-4 flex flex-col gap-2">
            {paged.items.map((item) => {
              const on = selected.includes(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(item.id)}
                    className={`flex w-full items-center gap-3 border px-4 py-3 text-left ${on ? "border-ink bg-white" : "border-line bg-white/40"}`}
                  >
                    {item.kind === "logo" ? (
                      <img src={`/api/identities/${item.id}/thumbnail`} alt="" className="h-10 w-10 object-contain" />
                    ) : (
                      <span className="text-sm">{item.text}</span>
                    )}
                    <span>
                      <span className="block">{item.name}</span>
                      <span className="text-sm text-bark/60">{item.kind === "logo" ? "Logo" : "Título"}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} />
        </>
      }
      form={
        chosen.length > 1 ? (
          <p className="text-sm text-bark/70">Selecciona un solo elemento para editarlo.</p>
        ) : (
          <IdentityForm
            key={single?.id ?? `new-${mode}-${openGroupId(filter) ?? "none"}`}
            title={single ? "Editar identidad" : mode === "logo" ? "Nuevo logo" : "Nuevo título"}
            initial={initial}
            previewId={single?.kind === "logo" ? single.id : null}
            error={error}
            pending={save.isPending}
            onSubmit={(draft, file) => save.mutate({ draft, file })}
            onDelete={single ? () => remove.mutate(single.id) : null}
            deleting={remove.isPending}
          />
        )
      }
    />
  )
}

function IdentityForm({
  title,
  initial,
  previewId,
  error,
  pending,
  onSubmit,
  onDelete,
  deleting,
}: {
  title: string
  initial: IdentityDraft
  previewId: string | null
  error: string | null
  pending: boolean
  onSubmit: (draft: IdentityDraft, file: File | null) => void
  onDelete: (() => void) | null
  deleting: boolean
}) {
  const [draft, setDraft] = useState(initial)
  const [file, setFile] = useState<File | null>(null)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(draft, file)
      }}
    >
      <h2 className="text-xl">{title}</h2>
      <Field label="Nombre en la biblioteca">
        <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Emaus 2027" />
      </Field>
      {draft.kind === "wordmark" ? (
        <Field label="Título en el marcapáginas">
          <TextInput
            value={draft.text}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            placeholder="Iglesia Adventista Emaus 2027"
          />
        </Field>
      ) : (
        <Field label={previewId ? "Sustituir archivo" : "Archivo"}>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
      )}
      {previewId ? <img src={`/api/identities/${previewId}/file`} alt="" className="max-h-40 object-contain" /> : null}
      <GroupField kind="identities" value={draft.groupId} onChange={(groupId) => setDraft({ ...draft, groupId })} />
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Guardar identidad
        </Button>
        {onDelete ? (
          <ConfirmButton label="Borrar" question="¿Borrar este elemento de identidad?" pending={deleting} onConfirm={onDelete} />
        ) : null}
      </div>
    </form>
  )
}
