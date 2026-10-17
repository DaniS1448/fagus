import { useEffect, useRef, useState, type ReactNode } from "react"
import { formatReference } from "../domain/reference"
import type { BibleText, Identity, ItemGroup, Photo, PhotoGroup, Quote } from "../domain/models"
import { Button } from "../ui/controls"
import { KindMark, type MarkKind } from "./marks"

type Libraries = {
  photos: Photo[]
  groups: PhotoGroup[]
  quotes: Quote[]
  quoteGroups: ItemGroup[]
  bibleTexts: BibleText[]
  bibleGroups: ItemGroup[]
  identities: Identity[]
  identityGroups: ItemGroup[]
}

type Filter = "all" | MarkKind

type PickerItem = {
  id: string
  kind: MarkKind
  groupId: string | null
  label: string
  detail: string
  haystack: string
}

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Todo" },
  { id: "photo", label: "Fotos" },
  { id: "quote", label: "Citas" },
  { id: "bible", label: "Textos" },
  { id: "identity", label: "Identidad" },
]

export function AddPicker({
  libraries,
  onClose,
  onPhoto,
  onQuote,
  onBible,
  onIdentity,
  onCreatePhoto,
  onCreateQuote,
  onCreateBible,
  onCreateWordmark,
  onCreateLogo,
}: {
  libraries: Libraries
  onClose: () => void
  onPhoto: (photo: Photo) => void
  onQuote: (quote: Quote | null) => void
  onBible: (text: BibleText | null) => void
  onIdentity: (item: Identity) => void
  onCreatePhoto: () => void
  onCreateQuote: () => void
  onCreateBible: () => void
  onCreateWordmark: () => void
  onCreateLogo: () => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [openDrawers, setOpenDrawers] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const foldedQuery = fold(query.trim())

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      const dialogs = document.querySelectorAll("[role='dialog']")
      const top = dialogs[dialogs.length - 1]
      if (top?.getAttribute("aria-label") !== "Añadir a esta cara") return
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function toggleDrawer(key: string) {
    setOpenDrawers((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }

  const visible = filter === "all" ? (["photo", "quote", "bible", "identity"] as const) : [filter]

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-bark/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Añadir a esta cara"
        className="flex max-h-[90vh] w-full max-w-lg flex-col bg-foam p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl">Añadir a esta cara</h2>
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar"
          aria-label="Buscar"
          className="mt-4 border border-line bg-white px-3 py-2"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button key={item.id} variant={filter === item.id ? "solid" : "quiet"} onClick={() => setFilter(item.id)}>
              <span className="inline-flex items-center gap-2">
                {item.id === "all" ? null : <KindMark kind={item.id} />}
                {item.label}
              </span>
            </Button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {visible.map((kind) => (
            <KindActions
              key={kind}
              kind={kind}
              onCreatePhoto={onCreatePhoto}
              onCreateQuote={onCreateQuote}
              onCreateBible={onCreateBible}
              onCreateWordmark={onCreateWordmark}
              onCreateLogo={onCreateLogo}
              onQuote={() => onQuote(null)}
              onBible={() => onBible(null)}
            />
          ))}
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          {visible.every((kind) => matchedItems(kind, libraries, foldedQuery).length === 0) ? (
            <p className="text-sm text-bark/60">{foldedQuery.length > 0 ? "Nada coincide." : "No hay nada en esta biblioteca."}</p>
          ) : (
            visible.map((kind) => (
              <KindList
                key={kind}
                title={filter === "all" ? kindTitle(kind) : null}
                kind={kind}
                items={matchedItems(kind, libraries, foldedQuery)}
                groups={groupsFor(kind, libraries)}
                searching={foldedQuery.length > 0}
                openDrawers={openDrawers}
                onToggle={toggleDrawer}
                onChoose={(item) => choose(item, libraries, { onPhoto, onQuote, onBible, onIdentity })}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function KindActions({
  kind,
  onCreatePhoto,
  onCreateQuote,
  onCreateBible,
  onCreateWordmark,
  onCreateLogo,
  onQuote,
  onBible,
}: {
  kind: MarkKind
  onCreatePhoto: () => void
  onCreateQuote: () => void
  onCreateBible: () => void
  onCreateWordmark: () => void
  onCreateLogo: () => void
  onQuote: () => void
  onBible: () => void
}) {
  switch (kind) {
    case "photo":
      return (
        <Button variant="quiet" onClick={onCreatePhoto}>
          Subir fotos
        </Button>
      )
    case "quote":
      return (
        <>
          <Button variant="quiet" onClick={onQuote}>
            Caja dinámica
          </Button>
          <Button variant="quiet" onClick={onCreateQuote}>
            Nueva cita
          </Button>
        </>
      )
    case "bible":
      return (
        <>
          <Button variant="quiet" onClick={onBible}>
            Caja dinámica
          </Button>
          <Button variant="quiet" onClick={onCreateBible}>
            Nuevo texto
          </Button>
        </>
      )
    case "identity":
      return (
        <>
          <Button variant="quiet" onClick={onCreateWordmark}>
            Nuevo título
          </Button>
          <Button variant="quiet" onClick={onCreateLogo}>
            Subir logo
          </Button>
        </>
      )
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function KindList({
  title,
  kind,
  items,
  groups,
  searching,
  openDrawers,
  onToggle,
  onChoose,
}: {
  title: string | null
  kind: MarkKind
  items: PickerItem[]
  groups: ItemGroup[]
  searching: boolean
  openDrawers: string[]
  onToggle: (key: string) => void
  onChoose: (item: PickerItem) => void
}) {
  if (items.length === 0) return null
  const { named, loose, showLoose } = splitDrawers(items, groups)
  return (
    <section>
      {title ? <h3 className="mb-2 text-sm">{title}</h3> : null}
      {searching ? (
        <ItemBody kind={kind} items={items} onChoose={onChoose} showDetail />
      ) : named.length === 0 ? (
        <ItemBody kind={kind} items={loose} onChoose={onChoose} showDetail={false} />
      ) : (
        <>
          {named.map((drawer) => (
            <Drawer
              key={drawer.id}
              label={drawer.name}
              count={drawer.items.length}
              open={openDrawers.includes(`${kind}:${drawer.id}`)}
              onToggle={() => onToggle(`${kind}:${drawer.id}`)}
            >
              <ItemBody kind={kind} items={drawer.items} onChoose={onChoose} showDetail={false} />
            </Drawer>
          ))}
          {loose.length > 0 ? (
            <Drawer
              label={showLoose ? "Sin agrupar" : "Todas"}
              count={loose.length}
              open={openDrawers.includes(`${kind}:none`)}
              onToggle={() => onToggle(`${kind}:none`)}
            >
              <ItemBody kind={kind} items={loose} onChoose={onChoose} showDetail={false} />
            </Drawer>
          ) : null}
        </>
      )}
    </section>
  )
}

function Drawer({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-t border-line">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center justify-between py-2 text-left text-sm">
        <span>{label}</span>
        <span className="text-bark/60">{count}</span>
      </button>
      {open ? <div className="pb-3">{children}</div> : null}
    </div>
  )
}

function ItemBody({
  kind,
  items,
  onChoose,
  showDetail,
}: {
  kind: MarkKind
  items: PickerItem[]
  onChoose: (item: PickerItem) => void
  showDetail: boolean
}) {
  if (kind === "photo") return <PhotoGrid items={items} onChoose={onChoose} showDetail={showDetail} />
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.id}>
          <TextRow item={item} onChoose={onChoose} showDetail={showDetail} />
        </li>
      ))}
    </ul>
  )
}

function PhotoGrid({
  items,
  onChoose,
  showDetail,
}: {
  items: PickerItem[]
  onChoose: (item: PickerItem) => void
  showDetail: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <button key={item.id} type="button" className="border border-line bg-paper text-left" onClick={() => onChoose(item)}>
          <img src={`/api/photos/${item.id}/thumbnail`} alt="" className="aspect-[3/4] w-full object-cover" />
          <span className="block truncate px-1 py-1 text-sm">{item.label}</span>
          {showDetail && item.detail ? <span className="block truncate px-1 pb-1 text-sm text-bark/60">{item.detail}</span> : null}
        </button>
      ))}
    </div>
  )
}

function TextRow({
  item,
  onChoose,
  showDetail = true,
}: {
  item: PickerItem
  onChoose: (item: PickerItem) => void
  showDetail?: boolean
}) {
  return (
    <button type="button" onClick={() => onChoose(item)} className="flex w-full items-start gap-2 py-2 text-left hover:bg-bark/5">
      <KindMark kind={item.kind} />
      <span className="min-w-0">
        <span className="block truncate">{item.label}</span>
        {showDetail && item.detail ? <span className="block truncate text-sm text-bark/60">{item.detail}</span> : null}
      </span>
    </button>
  )
}

function splitDrawers(items: PickerItem[], groups: ItemGroup[]) {
  const known = new Set(groups.map((group) => group.id))
  const named = groups
    .map((group) => ({ id: group.id, name: group.name, items: items.filter((item) => item.groupId === group.id) }))
    .filter((entry) => entry.items.length > 0)
  const loose = items.filter((item) => item.groupId == null || !known.has(item.groupId))
  return { named, loose, showLoose: named.length > 0 && loose.length > 0 }
}

function matchedItems(kind: MarkKind, libraries: Libraries, foldedQuery: string): PickerItem[] {
  const items = itemsFor(kind, libraries)
  if (foldedQuery.length === 0) return items
  return items.filter((item) => item.haystack.includes(foldedQuery))
}

function choose(
  item: PickerItem,
  libraries: Libraries,
  actions: {
    onPhoto: (photo: Photo) => void
    onQuote: (quote: Quote | null) => void
    onBible: (text: BibleText | null) => void
    onIdentity: (item: Identity) => void
  },
) {
  switch (item.kind) {
    case "photo": {
      const photo = libraries.photos.find((entry) => entry.id === item.id)
      if (photo) actions.onPhoto(photo)
      return
    }
    case "quote": {
      const quote = libraries.quotes.find((entry) => entry.id === item.id)
      if (quote) actions.onQuote(quote)
      return
    }
    case "bible": {
      const text = libraries.bibleTexts.find((entry) => entry.id === item.id)
      if (text) actions.onBible(text)
      return
    }
    case "identity": {
      const identity = libraries.identities.find((entry) => entry.id === item.id)
      if (identity) actions.onIdentity(identity)
      return
    }
    default: {
      const unknown: never = item.kind
      return unknown
    }
  }
}

function itemsFor(kind: MarkKind, libraries: Libraries): PickerItem[] {
  switch (kind) {
    case "photo":
      return libraries.photos.map((photo) => ({
        id: photo.id,
        kind,
        groupId: photo.groupId,
        label: photo.name,
        detail: groupLabel(libraries.groups, photo.groupId, libraries.photos),
        haystack: fold(`${photo.name} ${nameOf(libraries.groups, photo.groupId)}`),
      }))
    case "quote":
      return libraries.quotes.map((quote) => ({
        id: quote.id,
        kind,
        groupId: quote.groupId,
        label: quote.body,
        detail: groupLabel(libraries.quoteGroups, quote.groupId, libraries.quotes),
        haystack: fold(`${quote.body} ${quote.attribution} ${nameOf(libraries.quoteGroups, quote.groupId)}`),
      }))
    case "bible":
      return libraries.bibleTexts.map((text) => {
        const reference = formatReference(text.book, text.chapter, text.verseStart, text.verseEnd)
        return {
          id: text.id,
          kind,
          groupId: text.groupId,
          label: reference,
          detail: groupLabel(libraries.bibleGroups, text.groupId, libraries.bibleTexts),
          haystack: fold(`${reference} ${text.book} ${text.body} ${text.translation} ${nameOf(libraries.bibleGroups, text.groupId)}`),
        }
      })
    case "identity":
      return libraries.identities.map((item) => ({
        id: item.id,
        kind,
        groupId: item.groupId,
        label: item.kind === "logo" ? item.name : item.text,
        detail: groupLabel(libraries.identityGroups, item.groupId, libraries.identities),
        haystack: fold(`${item.name} ${item.text} ${nameOf(libraries.identityGroups, item.groupId)}`),
      }))
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function groupsFor(kind: MarkKind, libraries: Libraries): ItemGroup[] {
  switch (kind) {
    case "photo":
      return libraries.groups
    case "quote":
      return libraries.quoteGroups
    case "bible":
      return libraries.bibleGroups
    case "identity":
      return libraries.identityGroups
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function groupLabel(groups: ItemGroup[], groupId: string | null, items: Array<{ groupId: string | null }>): string {
  const name = nameOf(groups, groupId)
  if (name) return name
  const namedHaveItems = groups.some((group) => items.some((item) => item.groupId === group.id))
  const loose = items.some((item) => item.groupId == null)
  return namedHaveItems && loose ? "Sin agrupar" : ""
}

function nameOf(groups: ItemGroup[], groupId: string | null): string {
  if (!groupId) return ""
  return groups.find((group) => group.id === groupId)?.name ?? ""
}

function kindTitle(kind: MarkKind): string {
  switch (kind) {
    case "photo":
      return "Fotos"
    case "quote":
      return "Citas"
    case "bible":
      return "Textos bíblicos"
    case "identity":
      return "Identidad"
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}
