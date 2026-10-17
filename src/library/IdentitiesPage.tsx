import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiError, apiForm, apiGet, apiJson } from "../api"
import { identityHasImage, type Identity, type IdentityKind, type IdentityLayout } from "../domain/models"
import { imageForm, prepareImage } from "../media"
import { Button, ConfirmButton, EmptyState, Field, Notice, TextInput } from "../ui/controls"
import { PAGE_SIZE, usePagedList } from "../ui/page"
import { Pager } from "../ui/Pager"
import { GroupField, GroupShelf, SelectionStrip, inDrawer, openGroupId, type DrawerFilter } from "./groups"
import { LibraryListTools } from "./listTools"
import { LibraryScreen } from "./LibraryScreen"
import { LibraryTransfer } from "./LibraryTransfer"
import { filterByQuery, listResetKey } from "./search"

type IdentityDraft = {
  kind: IdentityKind
  name: string
  text: string
  layout: IdentityLayout
  textShare: number
  groupId: string
}

export function IdentitiesPage() {
  const queryClient = useQueryClient()
  const identities = useQuery({ queryKey: ["identities"], queryFn: () => apiGet<Identity[]>("/api/identities") })
  const [filter, setFilter] = useState<DrawerFilter>("all")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState<IdentityKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const visible = inDrawer(identities.data ?? [], filter)
  const matches = filterByQuery(visible, query, (item) => `${item.name} ${item.text} ${kindSearch(item.kind)}`)
  const paged = usePagedList(matches, PAGE_SIZE.library, listResetKey(filter, query))
  const chosen = (identities.data ?? []).filter((item) => selected.includes(item.id))
  const single = chosen.length === 1 ? chosen[0] : null
  const mode = single?.kind ?? creating ?? "wordmark"

  function toggle(id: string) {
    setCreating(null)
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
    setError(null)
  }

  function begin(kind: IdentityKind) {
    setSelected([])
    setCreating(kind)
    setError(null)
  }

  const save = useMutation({
    mutationFn: async (input: { draft: IdentityDraft; file: File | null }) => {
      const groupId = input.draft.groupId === "none" ? null : input.draft.groupId
      switch (input.draft.kind) {
        case "wordmark": {
          const payload = { kind: "wordmark" as const, name: input.draft.name, text: input.draft.text, groupId }
          return single
            ? apiJson<Identity>(`/api/identities/${single.id}`, "PATCH", payload)
            : apiJson<Identity>("/api/identities", "POST", payload)
        }
        case "lockup": {
          if (!input.file) {
            if (!single) throw new ApiError("Elige el archivo del logo")
            return apiJson<Identity>(`/api/identities/${single.id}`, "PATCH", {
              kind: "lockup" as const,
              name: input.draft.name,
              text: input.draft.text,
              layout: input.draft.layout,
              textShare: input.draft.textShare,
              groupId,
            })
          }
          const prepared = await prepareImage(input.file)
          const body = imageForm(prepared, input.draft.name || input.file.name, groupId ?? undefined, {
            kind: "lockup",
            text: input.draft.text,
            layout: input.draft.layout,
            textShare: input.draft.textShare,
          })
          return single
            ? apiForm<Identity>(`/api/identities/${single.id}`, "PATCH", body)
            : apiForm<Identity>("/api/identities", "POST", body)
        }
        case "logo": {
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
        }
        default: {
          const unknown: never = input.draft.kind
          return unknown
        }
      }
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
    ? { kind: single.kind, name: single.name, text: single.text, layout: single.layout ?? "stack", textShare: single.textShare ?? 50, groupId: single.groupId ?? "none" }
    : { kind: mode, name: "", text: "", layout: "stack", textShare: 50, groupId: openGroupId(filter) ?? "none" }

  return (
    <LibraryScreen
      title="Identidad"
      lede="Títulos, logos y los dos juntos. No entran en el sorteo: en el diseño se eligen y se quedan fijos."
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
            <Button variant="quiet" onClick={() => begin("lockup")}>
              Logo y título
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
                    {identityHasImage(item.kind) ? (
                      <img src={`/api/identities/${item.id}/thumbnail`} alt="" className="h-10 w-10 object-contain" />
                    ) : (
                      <span className="text-sm">{item.text}</span>
                    )}
                    <span>
                      <span className="block">{item.name}</span>
                      {item.kind === "lockup" ? <span className="block text-sm">{item.text}</span> : null}
                      <span className="text-sm text-bark/60">{kindLabel(item.kind)}</span>
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
            title={single ? "Editar identidad" : formTitle(mode)}
            initial={initial}
            previewId={single && identityHasImage(single.kind) ? single.id : null}
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
      {fieldsFor(draft.kind).text ? (
        <Field label="Título en el marcapáginas">
          <TextInput
            value={draft.text}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            placeholder="Iglesia Adventista Emaus 2027"
          />
        </Field>
      ) : null}
      {fieldsFor(draft.kind).layout ? (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend>Disposición</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="layout"
              checked={draft.layout === "stack"}
              onChange={() => setDraft({ ...draft, layout: "stack" })}
            />
            Logo arriba, título debajo
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="layout" checked={draft.layout === "row"} onChange={() => setDraft({ ...draft, layout: "row" })} />
            Logo a la izquierda, título a la derecha
          </label>
        </fieldset>
      ) : null}
      {fieldsFor(draft.kind).layout ? <TextShareField value={draft.textShare} onChange={(textShare) => setDraft({ ...draft, textShare })} /> : null}
      {fieldsFor(draft.kind).file ? (
        <Field label={previewId ? "Sustituir archivo" : "Archivo"}>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
      ) : null}
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

function TextShareField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <Field label="Proporción del título">
      <input type="range" min={20} max={80} step={5} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="text-sm text-bark/70">
        El título ocupa el {value}% y el logo el {100 - value}%.
      </span>
    </Field>
  )
}

function fieldsFor(kind: IdentityKind): { text: boolean; file: boolean; layout: boolean } {
  switch (kind) {
    case "wordmark":
      return { text: true, file: false, layout: false }
    case "logo":
      return { text: false, file: true, layout: false }
    case "lockup":
      return { text: true, file: true, layout: true }
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function formTitle(kind: IdentityKind): string {
  switch (kind) {
    case "logo":
      return "Nuevo logo"
    case "wordmark":
      return "Nuevo título"
    case "lockup":
      return "Logo y título"
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function kindLabel(kind: IdentityKind): string {
  switch (kind) {
    case "logo":
      return "Logo"
    case "wordmark":
      return "Título"
    case "lockup":
      return "Logo y título"
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function kindSearch(kind: IdentityKind): string {
  switch (kind) {
    case "logo":
      return "logo"
    case "wordmark":
      return "título"
    case "lockup":
      return "logo y título"
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}
