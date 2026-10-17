import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiError, apiGet, apiJson } from "../api"
import type { BibleText } from "../domain/models"
import { formatReference } from "../domain/reference"
import { Button, ConfirmButton, EmptyState, Field, Notice, TextArea, TextInput } from "../ui/controls"
import { GroupField, GroupShelf, SelectionStrip, inDrawer, openGroupId, type DrawerFilter } from "./groups"
import { LibraryScreen } from "./LibraryScreen"
import { LibraryTransfer } from "./LibraryTransfer"

type BibleDraft = {
  book: string
  chapter: string
  verseStart: string
  verseEnd: string
  body: string
  translation: string
  groupId: string
}

const emptyDraft: BibleDraft = {
  book: "",
  chapter: "",
  verseStart: "",
  verseEnd: "",
  body: "",
  translation: "",
  groupId: "none",
}

export function BiblePage() {
  const queryClient = useQueryClient()
  const texts = useQuery({ queryKey: ["bible"], queryFn: () => apiGet<BibleText[]>("/api/bible-texts") })
  const [filter, setFilter] = useState<DrawerFilter>("all")
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const visible = inDrawer(texts.data ?? [], filter)
  const chosen = (texts.data ?? []).filter((text) => selected.includes(text.id))
  const single = chosen.length === 1 ? chosen[0] : null

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
    setError(null)
  }

  const save = useMutation({
    mutationFn: (draft: BibleDraft) => {
      const payload = {
        book: draft.book,
        chapter: Number(draft.chapter),
        verseStart: Number(draft.verseStart),
        verseEnd: draft.verseEnd.trim() === "" ? null : Number(draft.verseEnd),
        body: draft.body,
        translation: draft.translation,
        groupId: draft.groupId === "none" ? null : draft.groupId,
      }
      return single
        ? apiJson<BibleText>(`/api/bible-texts/${single.id}`, "PATCH", payload)
        : apiJson<BibleText>("/api/bible-texts", "POST", payload)
    },
    onSuccess: async (text) => {
      setSelected([text.id])
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["bible"] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiJson<void>(`/api/bible-texts/${id}`, "DELETE"),
    onSuccess: async () => {
      setSelected([])
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["bible"] })
    },
  })

  const initial: BibleDraft = single
    ? {
        book: single.book,
        chapter: String(single.chapter),
        verseStart: String(single.verseStart),
        verseEnd: single.verseEnd == null ? "" : String(single.verseEnd),
        body: single.body,
        translation: single.translation,
        groupId: single.groupId ?? "none",
      }
    : { ...emptyDraft, groupId: openGroupId(filter) ?? "none" }

  return (
    <LibraryScreen
      title="Textos bíblicos"
      lede="El libro, el capítulo y el versículo se guardan aparte. En el marcapáginas la referencia se compone sola."
      actions={<LibraryTransfer scope="bible" />}
      list={
        <>
          <GroupShelf kind="bible" filter={filter} onFilter={setFilter} dissolveCopy="Los textos pasan a Sin agrupar." />
          <div className="mt-6">
            <Button
              variant="quiet"
              onClick={() => {
                setSelected([])
                setError(null)
              }}
            >
              Nuevo texto
            </Button>
          </div>
          <SelectionStrip
            kind="bible"
            ids={selected}
            noun={{ one: "texto", many: "textos" }}
            onDone={() => {
              setSelected([])
              void queryClient.invalidateQueries({ queryKey: ["bible"] })
            }}
          />
          {texts.data && visible.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="Este cajón está vacío">Añade un pasaje para poder usarlo en los diseños.</EmptyState>
            </div>
          ) : null}
          <ul className="mt-4 flex flex-col gap-2">
            {visible.map((text) => {
              const on = selected.includes(text.id)
              return (
                <li key={text.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(text.id)}
                    className={`w-full border px-4 py-3 text-left ${on ? "border-ink bg-white" : "border-line bg-white/40"}`}
                  >
                    <span className="text-sm text-ink">
                      {formatReference(text.book, text.chapter, text.verseStart, text.verseEnd)}
                    </span>
                    <span className="mt-1 line-clamp-2 block">{text.body}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      }
      form={
        chosen.length > 1 ? (
          <p className="text-sm text-bark/70">Selecciona un solo texto para editarlo.</p>
        ) : (
          <BibleForm
            key={single?.id ?? `new-${openGroupId(filter) ?? "none"}`}
            title={single ? "Editar texto" : "Nuevo texto"}
            initial={initial}
            error={error}
            pending={save.isPending}
            onSubmit={(draft) => save.mutate(draft)}
            onDelete={single ? () => remove.mutate(single.id) : null}
            deleting={remove.isPending}
          />
        )
      }
    />
  )
}

function BibleForm({
  title,
  initial,
  error,
  pending,
  onSubmit,
  onDelete,
  deleting,
}: {
  title: string
  initial: BibleDraft
  error: string | null
  pending: boolean
  onSubmit: (draft: BibleDraft) => void
  onDelete: (() => void) | null
  deleting: boolean
}) {
  const [draft, setDraft] = useState(initial)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(draft)
      }}
    >
      <h2 className="text-xl">{title}</h2>
      <Field label="Libro">
        <TextInput value={draft.book} onChange={(event) => setDraft({ ...draft, book: event.target.value })} placeholder="Juan" />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Capítulo">
          <TextInput value={draft.chapter} onChange={(event) => setDraft({ ...draft, chapter: event.target.value })} inputMode="numeric" />
        </Field>
        <Field label="Desde">
          <TextInput
            value={draft.verseStart}
            onChange={(event) => setDraft({ ...draft, verseStart: event.target.value })}
            inputMode="numeric"
          />
        </Field>
        <Field label="Hasta">
          <TextInput
            value={draft.verseEnd}
            onChange={(event) => setDraft({ ...draft, verseEnd: event.target.value })}
            inputMode="numeric"
            placeholder="Opcional"
          />
        </Field>
      </div>
      <Field label="Texto">
        <TextArea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
      </Field>
      <Field label="Traducción">
        <TextInput
          value={draft.translation}
          onChange={(event) => setDraft({ ...draft, translation: event.target.value })}
          placeholder="Opcional"
        />
      </Field>
      <GroupField kind="bible" value={draft.groupId} onChange={(groupId) => setDraft({ ...draft, groupId })} />
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Guardar texto
        </Button>
        {onDelete ? (
          <ConfirmButton label="Borrar" question="¿Borrar este texto bíblico?" pending={deleting} onConfirm={onDelete} />
        ) : null}
      </div>
    </form>
  )
}
