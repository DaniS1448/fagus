import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiError, apiGet, apiJson } from "../api"
import type { Quote } from "../domain/models"
import { Button, ConfirmButton, EmptyState, Field, Notice, TextArea, TextInput } from "../ui/controls"
import { PAGE_SIZE, usePagedList } from "../ui/page"
import { Pager } from "../ui/Pager"
import { GroupField, GroupShelf, SelectionStrip, inDrawer, openGroupId, type DrawerFilter } from "./groups"
import { LibraryScreen } from "./LibraryScreen"
import { LibraryTransfer } from "./LibraryTransfer"

type QuoteDraft = { body: string; attribution: string; groupId: string }

export function QuotesPage() {
  const queryClient = useQueryClient()
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: () => apiGet<Quote[]>("/api/quotes") })
  const [filter, setFilter] = useState<DrawerFilter>("all")
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const visible = inDrawer(quotes.data ?? [], filter)
  const paged = usePagedList(visible, PAGE_SIZE.library, filter)
  const chosen = (quotes.data ?? []).filter((quote) => selected.includes(quote.id))
  const single = chosen.length === 1 ? chosen[0] : null

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
    setError(null)
  }

  function beginCreate() {
    setSelected([])
    setError(null)
  }

  const save = useMutation({
    mutationFn: (draft: QuoteDraft) => {
      const payload = {
        body: draft.body,
        attribution: draft.attribution,
        groupId: draft.groupId === "none" ? null : draft.groupId,
      }
      return single
        ? apiJson<Quote>(`/api/quotes/${single.id}`, "PATCH", payload)
        : apiJson<Quote>("/api/quotes", "POST", payload)
    },
    onSuccess: async (quote) => {
      setSelected([quote.id])
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
      actions={<LibraryTransfer scope="quotes" />}
      list={
        <>
          <GroupShelf kind="quotes" filter={filter} onFilter={setFilter} dissolveCopy="Las citas pasan a Sin agrupar." />
          <div className="mt-6">
            <Button variant="quiet" onClick={beginCreate}>
              Nueva cita
            </Button>
          </div>
          <SelectionStrip
            kind="quotes"
            ids={selected}
            noun={{ one: "cita", many: "citas" }}
            onDone={() => {
              setSelected([])
              void queryClient.invalidateQueries({ queryKey: ["quotes"] })
            }}
          />
          {quotes.data && visible.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="Este cajón está vacío">Escribe la primera cita en la ficha.</EmptyState>
            </div>
          ) : null}
          <ul className="mt-4 flex flex-col gap-2">
            {paged.items.map((quote) => {
              const on = selected.includes(quote.id)
              return (
                <li key={quote.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(quote.id)}
                    className={`w-full border px-4 py-3 text-left ${on ? "border-ink bg-white" : "border-line bg-white/40"}`}
                  >
                    <span className="line-clamp-2">{quote.body}</span>
                    {quote.attribution ? <span className="mt-1 block text-sm text-bark/60">{quote.attribution}</span> : null}
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
          <p className="text-sm text-bark/70">Selecciona una sola cita para editarla.</p>
        ) : (
          <QuoteForm
            key={single?.id ?? `new-${openGroupId(filter) ?? "none"}`}
            title={single ? "Editar cita" : "Nueva cita"}
            initial={{
              body: single?.body ?? "",
              attribution: single?.attribution ?? "",
              groupId: single ? (single.groupId ?? "none") : (openGroupId(filter) ?? "none"),
            }}
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

function QuoteForm({
  title,
  initial,
  error,
  pending,
  onSubmit,
  onDelete,
  deleting,
}: {
  title: string
  initial: QuoteDraft
  error: string | null
  pending: boolean
  onSubmit: (draft: QuoteDraft) => void
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
      <Field label="Texto">
        <TextArea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
      </Field>
      <Field label="Atribución">
        <TextInput
          value={draft.attribution}
          onChange={(event) => setDraft({ ...draft, attribution: event.target.value })}
          placeholder="Opcional"
        />
      </Field>
      <GroupField kind="quotes" value={draft.groupId} onChange={(groupId) => setDraft({ ...draft, groupId })} />
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Guardar cita
        </Button>
        {onDelete ? <ConfirmButton label="Borrar" question="¿Borrar esta cita?" pending={deleting} onConfirm={onDelete} /> : null}
      </div>
    </form>
  )
}
