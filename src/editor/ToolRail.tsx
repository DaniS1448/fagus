import { useRef, useState, type DragEvent } from "react"
import { createBibleElement, createIdentityElement, createPhotoElement, createQuoteElement, type BookmarkElement } from "../domain/document"
import type { BibleText, Identity, ItemGroup, Photo, PhotoGroup, Quote } from "../domain/models"
import { formatReference } from "../domain/reference"
import { Button } from "../ui/controls"
import { AddPicker } from "./AddPicker"
import { KindMark, type MarkKind } from "./marks"
import { activeDocument, useEditorStore, type LayerPlace } from "./store"

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

export function ToolRail({
  libraries,
  onCreatePhoto,
  onCreateQuote,
  onCreateBible,
  onCreateWordmark,
  onCreateLogo,
}: {
  libraries: Libraries
  onCreatePhoto: () => void
  onCreateQuote: () => void
  onCreateBible: () => void
  onCreateWordmark: () => void
  onCreateLogo: () => void
}) {
  const draft = useEditorStore((state) => state.draft)
  const side = useEditorStore((state) => state.side)
  const selectedId = useEditorStore((state) => state.selectedId)
  const select = useEditorStore((state) => state.select)
  const addElement = useEditorStore((state) => state.addElement)
  const moveLayer = useEditorStore((state) => state.moveLayer)
  const [adding, setAdding] = useState(false)
  const [drop, setDrop] = useState<{ id: string; place: LayerPlace } | null>(null)
  const dragging = useRef<string | null>(null)
  if (!draft) return null
  const document = activeDocument(draft, side)
  const layers = [...document.elements].reverse()

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto border-r border-line bg-foam px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm">En esta cara</h2>
        <Button onClick={() => setAdding(true)}>Añadir</Button>
      </div>
      <p className="text-sm text-bark/60">Arrastra una capa. Lo de arriba tapa lo de abajo.</p>
      {layers.length === 0 ? <p className="text-sm text-bark/60">Esta cara está vacía.</p> : null}
      <ol
        className="flex flex-col"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const id = dragging.current
          if (id && drop) moveLayer(id, drop.id, drop.place)
          dragging.current = null
          setDrop(null)
        }}
      >
        {layers.map((element) => {
          const copy = layerCopy(element, libraries)
          const selected = element.id === selectedId
          const place = drop?.id === element.id ? drop.place : null
          return (
            <li
              key={element.id}
              draggable
              onDragStart={(event) => startLayerDrag(event, element.id, dragging)}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
                const placeOver = dropPlace(event)
                setDrop((current) => (current?.id === element.id && current.place === placeOver ? current : { id: element.id, place: placeOver }))
              }}
              onDrop={(event) => {
                event.preventDefault()
                event.stopPropagation()
                const id = dragging.current
                const placeOver = dropPlace(event)
                if (id) moveLayer(id, element.id, placeOver)
                dragging.current = null
                setDrop(null)
              }}
              onDragEnd={() => {
                dragging.current = null
                setDrop(null)
              }}
              className={place === "above" ? "border-t-2 border-ink" : place === "below" ? "border-b-2 border-ink" : "border-y-2 border-transparent"}
            >
              <button
                type="button"
                onClick={() => select(element.id)}
                className={`flex w-full cursor-grab items-start gap-2 px-2 py-2 text-left active:cursor-grabbing ${selected ? "bg-ink text-paper" : "hover:bg-bark/5"}`}
              >
                <Grip />
                <KindMark kind={copy.mark} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{copy.name}</span>
                  <span className={`block text-sm ${selected ? "text-paper/70" : "text-bark/60"}`}>{copy.kind}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {adding ? (
        <AddPicker
          libraries={libraries}
          onClose={() => setAdding(false)}
          onPhoto={(photo) => {
            addElement(createPhotoElement(photo.id, draft.widthMm, draft.heightMm), "back")
            setAdding(false)
          }}
          onQuote={(quote) => {
            const element = createQuoteElement(draft.widthMm, draft.heightMm)
            addElement(quote ? { ...element, mode: "fixed", quoteId: quote.id } : element, "front")
            setAdding(false)
          }}
          onBible={(text) => {
            const element = createBibleElement(draft.widthMm, draft.heightMm)
            addElement(text ? { ...element, mode: "fixed", bibleTextId: text.id } : element, "front")
            setAdding(false)
          }}
          onIdentity={(item) => {
            addElement(createIdentityElement(item.id, item.kind, draft.widthMm, draft.heightMm), "front")
            setAdding(false)
          }}
          onCreatePhoto={onCreatePhoto}
          onCreateQuote={onCreateQuote}
          onCreateBible={onCreateBible}
          onCreateWordmark={onCreateWordmark}
          onCreateLogo={onCreateLogo}
        />
      ) : null}
    </div>
  )
}

function Grip() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="mt-0.5 shrink-0">
      <path d="M5 4h6M5 8h6M5 12h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}

function startLayerDrag(event: DragEvent<HTMLLIElement>, id: string, dragging: { current: string | null }) {
  dragging.current = id
  event.dataTransfer.effectAllowed = "move"
  event.dataTransfer.setData("text/plain", id)
}

function dropPlace(event: DragEvent<HTMLLIElement>): LayerPlace {
  const bounds = event.currentTarget.getBoundingClientRect()
  return event.clientY < bounds.top + bounds.height / 2 ? "above" : "below"
}

function layerCopy(element: BookmarkElement, libraries: Libraries): { name: string; kind: string; mark: MarkKind } {
  switch (element.type) {
    case "photo":
      return {
        name: libraries.photos.find((photo) => photo.id === element.photoId)?.name ?? "Foto",
        kind: "Foto",
        mark: "photo",
      }
    case "quote": {
      if (element.mode === "pool") return { name: "Cita dinámica", kind: "Cita", mark: "quote" }
      const quote = libraries.quotes.find((item) => item.id === element.quoteId)
      return { name: quote ? clip(quote.body) : "Cita", kind: "Cita", mark: "quote" }
    }
    case "bible": {
      if (element.mode === "pool") return { name: "Texto dinámico", kind: "Texto", mark: "bible" }
      const text = libraries.bibleTexts.find((item) => item.id === element.bibleTextId)
      return {
        name: text ? formatReference(text.book, text.chapter, text.verseStart, text.verseEnd) : "Texto",
        kind: "Texto",
        mark: "bible",
      }
    }
    case "identity": {
      const identity = libraries.identities.find((item) => item.id === element.identityId)
      if (!identity) return { name: "Identidad", kind: "Identidad", mark: "identity" }
      if (identity.kind === "logo") return { name: identity.name, kind: "Logo", mark: "identity" }
      return { name: identity.text, kind: "Título", mark: "identity" }
    }
    default: {
      const unknown: never = element
      return unknown
    }
  }
}

function clip(value: string): string {
  const line = value.replace(/\s+/g, " ").trim()
  return line.length > 72 ? `${line.slice(0, 72)}…` : line
}
