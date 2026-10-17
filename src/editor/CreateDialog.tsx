import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiError, apiForm, apiJson } from "../api"
import type { BibleText, Identity, Photo, Quote } from "../domain/models"
import { imageForm, prepareImage } from "../media"
import { Button, Field, Notice, TextArea, TextInput } from "../ui/controls"

export type DialogKind = "quote" | "bible" | "wordmark" | "logo" | "photo"

export function CreateDialog({
  kind,
  onClose,
}: {
  kind: DialogKind
  onClose: () => void
}) {
  const title = {
    quote: "Nueva cita",
    bible: "Nuevo texto bíblico",
    wordmark: "Nuevo título",
    logo: "Nuevo logo",
    photo: "Subir foto",
  }[kind]

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-bark/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-md overflow-auto bg-foam p-5 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl">{title}</h2>
        <div className="mt-4">
          <DialogForm kind={kind} onClose={onClose} />
        </div>
      </div>
    </div>
  )
}

function DialogForm({ kind, onClose }: { kind: DialogKind; onClose: () => void }) {
  switch (kind) {
    case "quote":
      return <QuoteForm onClose={onClose} />
    case "bible":
      return <BibleForm onClose={onClose} />
    case "wordmark":
      return <WordmarkForm onClose={onClose} />
    case "logo":
      return <LogoForm onClose={onClose} />
    case "photo":
      return <PhotoForm onClose={onClose} />
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function QuoteForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState("")
  const [attribution, setAttribution] = useState("")
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => apiJson<Quote>("/api/quotes", "POST", { body, attribution }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"] })
      onClose()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <Field label="Texto">
        <TextArea value={body} onChange={(event) => setBody(event.target.value)} />
      </Field>
      <Field label="Atribución">
        <TextInput value={attribution} onChange={(event) => setAttribution(event.target.value)} />
      </Field>
      {error ? <Notice>{error}</Notice> : null}
      <FormActions pending={save.isPending} onClose={onClose} label="Guardar cita" />
    </form>
  )
}

function BibleForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [book, setBook] = useState("")
  const [chapter, setChapter] = useState("")
  const [verseStart, setVerseStart] = useState("")
  const [verseEnd, setVerseEnd] = useState("")
  const [body, setBody] = useState("")
  const [translation, setTranslation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      apiJson<BibleText>("/api/bible-texts", "POST", {
        book,
        chapter: Number(chapter),
        verseStart: Number(verseStart),
        verseEnd: verseEnd.trim() === "" ? null : Number(verseEnd),
        body,
        translation,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bible"] })
      onClose()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <Field label="Libro">
        <TextInput value={book} onChange={(event) => setBook(event.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Capítulo">
          <TextInput value={chapter} onChange={(event) => setChapter(event.target.value)} />
        </Field>
        <Field label="Desde">
          <TextInput value={verseStart} onChange={(event) => setVerseStart(event.target.value)} />
        </Field>
        <Field label="Hasta">
          <TextInput value={verseEnd} onChange={(event) => setVerseEnd(event.target.value)} />
        </Field>
      </div>
      <Field label="Texto">
        <TextArea value={body} onChange={(event) => setBody(event.target.value)} />
      </Field>
      <Field label="Traducción">
        <TextInput value={translation} onChange={(event) => setTranslation(event.target.value)} />
      </Field>
      {error ? <Notice>{error}</Notice> : null}
      <FormActions pending={save.isPending} onClose={onClose} label="Guardar texto" />
    </form>
  )
}

function WordmarkForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => apiJson<Identity>("/api/identities", "POST", { kind: "wordmark", name, text }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["identities"] })
      onClose()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <Field label="Nombre en la biblioteca">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Emaus 2027" />
      </Field>
      <Field label="Título">
        <TextInput value={text} onChange={(event) => setText(event.target.value)} placeholder="Iglesia Adventista Emaus 2027" />
      </Field>
      {error ? <Notice>{error}</Notice> : null}
      <FormActions pending={save.isPending} onClose={onClose} label="Guardar título" />
    </form>
  )
}

function LogoForm({ onClose }: { onClose: () => void }) {
  return <ImageForm kind="logo" onClose={onClose} />
}

function PhotoForm({ onClose }: { onClose: () => void }) {
  return <ImageForm kind="photo" onClose={onClose} />
}

function ImageForm({ kind, onClose }: { kind: "logo" | "photo"; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      if (!file) throw new ApiError("Elige un archivo")
      const prepared = await prepareImage(file)
      const body = imageForm(prepared, name || file.name.replace(/\.[^.]+$/, ""))
      if (kind === "photo") return apiForm<Photo>("/api/photos", "POST", body)
      return apiForm<Identity>("/api/identities", "POST", body)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [kind === "photo" ? "photos" : "identities"] })
      onClose()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <Field label="Nombre">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Archivo">
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </Field>
      {error ? <Notice>{error}</Notice> : null}
      <FormActions pending={save.isPending} onClose={onClose} label={kind === "photo" ? "Subir foto" : "Guardar logo"} />
    </form>
  )
}

function FormActions({ pending, onClose, label }: { pending: boolean; onClose: () => void; label: string }) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={pending}>
        {label}
      </Button>
      <Button variant="quiet" onClick={onClose}>
        Cancelar
      </Button>
    </div>
  )
}
