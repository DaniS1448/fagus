import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiError, apiGet, apiJson } from "../api"
import type { Quote } from "../domain/models"
import { Button, EmptyState, Field, Notice, TextArea, TextInput } from "../ui/controls"
import { LibraryScreen } from "./LibraryScreen"

const emptyForm = { body: "", attribution: "" }

export function QuotesPage() {
  const queryClient = useQueryClient()
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: () => apiGet<Quote[]>("/api/quotes") })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const selected = quotes.data?.find((quote) => quote.id === selectedId) ?? null

  function beginCreate() {
    setSelectedId(null)
    setForm(emptyForm)
    setError(null)
  }

  function beginEdit(quote: Quote) {
    setSelectedId(quote.id)
    setForm({ body: quote.body, attribution: quote.attribution })
    setError(null)
  }

  const save = useMutation({
    mutationFn: () =>
      selected
        ? apiJson<Quote>(`/api/quotes/${selected.id}`, "PATCH", form)
        : apiJson<Quote>("/api/quotes", "POST", form),
    onSuccess: async (quote) => {
      setSelectedId(quote.id)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["quotes"] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo guardar"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiJson<void>(`/api/quotes/${id}`, "DELETE"),
    onSuccess: async () => {
      beginCreate()
      await queryClient.invalidateQueries({ queryKey: ["quotes"] })
    },
  })

  return (
    <LibraryScreen
      title="Citas"
      lede="Textos breves para colocar sobre el marcapáginas. En el diseño puedes fijar una o dejar que se sortee."
      list={
        <>
          <Button variant="quiet" onClick={beginCreate}>
            Nueva cita
          </Button>
          {quotes.data && quotes.data.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="La biblioteca de citas está vacía">Escribe la primera en el panel de la derecha.</EmptyState>
            </div>
          ) : null}
          <ul className="mt-4 flex flex-col gap-2">
            {quotes.data?.map((quote) => (
              <li key={quote.id}>
                <button
                  type="button"
                  onClick={() => beginEdit(quote)}
                  className={`w-full border px-4 py-3 text-left ${quote.id === selectedId ? "border-ink bg-white" : "border-line bg-white/40"}`}
                >
                  <span className="line-clamp-2">{quote.body}</span>
                  {quote.attribution ? <span className="mt-1 block text-sm text-bark/60">{quote.attribution}</span> : null}
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
          <h2 className="text-xl">{selected ? "Editar cita" : "Nueva cita"}</h2>
          <Field label="Texto">
            <TextArea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </Field>
          <Field label="Atribución">
            <TextInput
              value={form.attribution}
              onChange={(event) => setForm({ ...form, attribution: event.target.value })}
              placeholder="Opcional"
            />
          </Field>
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              Guardar cita
            </Button>
            {selected ? (
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm("¿Borrar esta cita?")) remove.mutate(selected.id)
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
