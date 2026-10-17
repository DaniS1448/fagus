import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiError, apiGet, apiJson } from "../api"
import type { BibleText } from "../domain/models"
import { formatReference } from "../domain/reference"
import { Button, ConfirmButton, EmptyState, Field, Notice, TextArea, TextInput } from "../ui/controls"
import { LibraryScreen } from "./LibraryScreen"

type BibleForm = {
  book: string
  chapter: string
  verseStart: string
  verseEnd: string
  body: string
  translation: string
}

const emptyForm: BibleForm = {
  book: "",
  chapter: "",
  verseStart: "",
  verseEnd: "",
  body: "",
  translation: "",
}

export function BiblePage() {
  const queryClient = useQueryClient()
  const texts = useQuery({ queryKey: ["bible"], queryFn: () => apiGet<BibleText[]>("/api/bible-texts") })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<BibleForm>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const selected = texts.data?.find((text) => text.id === selectedId) ?? null

  function beginCreate() {
    setSelectedId(null)
    setForm(emptyForm)
    setError(null)
  }

  function beginEdit(text: BibleText) {
    setSelectedId(text.id)
    setForm({
      book: text.book,
      chapter: String(text.chapter),
      verseStart: String(text.verseStart),
      verseEnd: text.verseEnd == null ? "" : String(text.verseEnd),
      body: text.body,
      translation: text.translation,
    })
    setError(null)
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        book: form.book,
        chapter: Number(form.chapter),
        verseStart: Number(form.verseStart),
        verseEnd: form.verseEnd.trim() === "" ? null : Number(form.verseEnd),
        body: form.body,
        translation: form.translation,
      }
      return selected
        ? apiJson<BibleText>(`/api/bible-texts/${selected.id}`, "PATCH", payload)
        : apiJson<BibleText>("/api/bible-texts", "POST", payload)
    },
    onSuccess: async (text) => {
      setSelectedId(text.id)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["bible"] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiJson<void>(`/api/bible-texts/${id}`, "DELETE"),
    onSuccess: async () => {
      beginCreate()
      await queryClient.invalidateQueries({ queryKey: ["bible"] })
    },
  })

  return (
    <LibraryScreen
      title="Textos bíblicos"
      lede="El libro, el capítulo y el versículo se guardan aparte. En el marcapáginas la referencia se compone sola."
      list={
        <>
          <Button variant="quiet" onClick={beginCreate}>
            Nuevo texto
          </Button>
          {texts.data && texts.data.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="Todavía no hay textos bíblicos">Añade un pasaje para poder usarlo en los diseños.</EmptyState>
            </div>
          ) : null}
          <ul className="mt-4 flex flex-col gap-2">
            {texts.data?.map((text) => (
              <li key={text.id}>
                <button
                  type="button"
                  onClick={() => beginEdit(text)}
                  className={`w-full border px-4 py-3 text-left ${text.id === selectedId ? "border-ink bg-white" : "border-line bg-white/40"}`}
                >
                  <span className="text-sm text-ink">
                    {formatReference(text.book, text.chapter, text.verseStart, text.verseEnd)}
                  </span>
                  <span className="mt-1 line-clamp-2 block">{text.body}</span>
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
          <h2 className="text-xl">{selected ? "Editar texto" : "Nuevo texto"}</h2>
          <Field label="Libro">
            <TextInput value={form.book} onChange={(event) => setForm({ ...form, book: event.target.value })} placeholder="Juan" />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Capítulo">
              <TextInput value={form.chapter} onChange={(event) => setForm({ ...form, chapter: event.target.value })} inputMode="numeric" />
            </Field>
            <Field label="Desde">
              <TextInput value={form.verseStart} onChange={(event) => setForm({ ...form, verseStart: event.target.value })} inputMode="numeric" />
            </Field>
            <Field label="Hasta">
              <TextInput value={form.verseEnd} onChange={(event) => setForm({ ...form, verseEnd: event.target.value })} inputMode="numeric" placeholder="Opcional" />
            </Field>
          </div>
          <Field label="Texto">
            <TextArea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </Field>
          <Field label="Traducción">
            <TextInput value={form.translation} onChange={(event) => setForm({ ...form, translation: event.target.value })} placeholder="Opcional" />
          </Field>
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              Guardar texto
            </Button>
            {selected ? (
              <ConfirmButton
                label="Borrar"
                question="¿Borrar este texto bíblico?"
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
