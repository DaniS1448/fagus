import { useState, type ReactNode } from "react"
import type { BookmarkElement } from "../domain/document"
import type { BibleText, Identity, ItemGroup, Photo, PhotoGroup, Quote } from "../domain/models"
import { activeDocument, useEditorStore } from "./store"

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
  if (!draft) return null
  const document = activeDocument(draft, side)
  const has = (type: BookmarkElement["type"]) => document.elements.some((element) => element.type === type)

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto border-r border-line bg-foam px-4 py-4">
      <Section title="En esta cara" defaultOpen>
        {document.elements.length === 0 ? <Hint>Esta cara está vacía.</Hint> : null}
        <ol className="flex flex-col gap-1">
          {[...document.elements].reverse().map((element) => (
            <li key={element.id}>
              <button
                type="button"
                onClick={() => select(element.id)}
                className={`w-full px-2 py-1 text-left text-sm ${element.id === selectedId ? "bg-ink text-paper" : "hover:bg-bark/5"}`}
              >
                {elementLabel(element, libraries)}
              </button>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Fotos" action="Subir" onAction={onCreatePhoto} defaultOpen>
        {libraries.photos.length === 0 ? <Hint>Sube una foto para encajarla en el marco.</Hint> : null}
        <PhotoDrawers
          photos={libraries.photos}
          groups={libraries.groups}
          onAdd={(photo) =>
            addElement(
              {
                id: crypto.randomUUID(),
                type: "photo",
                photoId: photo.id,
                x: 0,
                y: 0,
                width: draft.widthMm,
                height: draft.heightMm,
                rotation: 0,
                fit: "cover",
                scale: 1,
                offsetX: 0,
                offsetY: 0,
              },
              "back",
            )
          }
        />
      </Section>
      <Section title="Citas" action="Nueva" onAction={onCreateQuote} defaultOpen={has("quote")}>
        <AddPool
          label="Caja dinámica"
          onClick={() => addElement(quoteElement(draft.widthMm, draft.heightMm, "pool", null), "front")}
        />
        <GroupedButtons
          items={libraries.quotes}
          groups={libraries.quoteGroups}
          label={(quote) => quote.body}
          onAdd={(quote) => addElement(quoteElement(draft.widthMm, draft.heightMm, "fixed", quote.id), "front")}
        />
      </Section>
      <Section title="Textos bíblicos" action="Nuevo" onAction={onCreateBible} defaultOpen={has("bible")}>
        <AddPool
          label="Caja dinámica"
          onClick={() => addElement(bibleElement(draft.widthMm, draft.heightMm, "pool", null), "front")}
        />
        <GroupedButtons
          items={libraries.bibleTexts}
          groups={libraries.bibleGroups}
          label={(text) => `${text.book} ${text.chapter}:${text.verseStart}`}
          onAdd={(text) => addElement(bibleElement(draft.widthMm, draft.heightMm, "fixed", text.id), "front")}
        />
      </Section>
      <Section title="Identidad" action="Título" onAction={onCreateWordmark} defaultOpen={has("identity")}>
        <button type="button" className="text-left text-sm text-ink underline" onClick={onCreateLogo}>
          Subir logo
        </button>
        <GroupedButtons
          items={libraries.identities}
          groups={libraries.identityGroups}
          label={(item) => (item.kind === "logo" ? item.name : item.text)}
          onAdd={(item) => addElement(identityElement(item, draft.widthMm, draft.heightMm), "front")}
        />
      </Section>
    </div>
  )
}

function quoteElement(
  pageWidth: number,
  pageHeight: number,
  mode: "fixed" | "pool",
  quoteId: string | null,
): BookmarkElement {
  const width = Math.max(12, pageWidth - 8)
  const height = Math.min(48, Math.max(24, pageHeight * 0.28))
  return {
    id: crypto.randomUUID(),
    type: "quote",
    mode,
    quoteId,
    poolIds: [],
    x: (pageWidth - width) / 2,
    y: pageHeight - height - 16,
    width,
    height,
    rotation: 0,
    style: {
      fontFamily: "libre-baskerville",
      fontSizeMm: 4.2,
      lineHeight: 1.25,
      align: "center",
      color: "#1A1814",
      letterSpacingMm: 0,
    },
    gapMm: 2,
  }
}

function bibleElement(
  pageWidth: number,
  pageHeight: number,
  mode: "fixed" | "pool",
  bibleTextId: string | null,
): BookmarkElement {
  const width = Math.max(12, pageWidth - 8)
  const height = Math.min(42, Math.max(22, pageHeight * 0.24))
  return {
    id: crypto.randomUUID(),
    type: "bible",
    mode,
    bibleTextId,
    poolIds: [],
    showReference: true,
    x: (pageWidth - width) / 2,
    y: Math.max(8, (pageHeight - height) / 2),
    width,
    height,
    rotation: 0,
    style: {
      fontFamily: "libre-baskerville",
      fontSizeMm: 3.6,
      lineHeight: 1.25,
      align: "center",
      color: "#1A1814",
      letterSpacingMm: 0,
    },
    referenceStyle: {
      fontFamily: "source-sans-3",
      fontSizeMm: 2.6,
      lineHeight: 1.2,
      align: "center",
      color: "#1A1814",
      letterSpacingMm: 0.05,
    },
    gapMm: 2,
  }
}

function identityElement(item: Identity, pageWidth: number, pageHeight: number): BookmarkElement {
  if (item.kind === "logo") {
    const size = Math.min(16, pageWidth - 8)
    return {
      id: crypto.randomUUID(),
      type: "identity",
      identityId: item.id,
      x: (pageWidth - size) / 2,
      y: 6,
      width: size,
      height: size,
      rotation: 0,
      fit: "contain",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      style: {
        fontFamily: "barlow-condensed",
        fontSizeMm: 3.2,
        lineHeight: 1.1,
        align: "center",
        color: "#1A1814",
        letterSpacingMm: 0.1,
      },
    }
  }
  const width = Math.max(12, pageWidth - 8)
  return {
    id: crypto.randomUUID(),
    type: "identity",
    identityId: item.id,
    x: (pageWidth - width) / 2,
    y: pageHeight - 18,
    width,
    height: 14,
    rotation: 0,
    fit: "contain",
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    style: {
      fontFamily: "barlow-condensed",
      fontSizeMm: 3.2,
      lineHeight: 1.1,
      align: "center",
      color: "#1A1814",
      letterSpacingMm: 0.12,
    },
  }
}

function elementLabel(element: BookmarkElement, libraries: Libraries): string {
  switch (element.type) {
    case "photo":
      return libraries.photos.find((photo) => photo.id === element.photoId)?.name ?? "Foto"
    case "quote":
      return element.mode === "pool" ? "Cita dinámica" : "Cita"
    case "bible":
      return element.mode === "pool" ? "Texto bíblico dinámico" : "Texto bíblico"
    case "identity": {
      const identity = libraries.identities.find((item) => item.id === element.identityId)
      if (!identity) return "Identidad"
      return identity.kind === "logo" ? identity.name : identity.text
    }
    default: {
      const unknown: never = element
      return unknown
    }
  }
}

function PhotoDrawers({
  photos,
  groups,
  onAdd,
}: {
  photos: Photo[]
  groups: PhotoGroup[]
  onAdd: (photo: Photo) => void
}) {
  const named = groups
    .map((group) => ({ group, photos: photos.filter((photo) => photo.groupId === group.id) }))
    .filter((entry) => entry.photos.length > 0)
  const loose = photos.filter((photo) => photo.groupId == null)
  const showLooseLabel = named.length > 0 && loose.length > 0
  return (
    <>
      {named.map((entry) => (
        <div key={entry.group.id} className="mb-2">
          <p className="px-1 pb-1 text-sm text-bark/60">{entry.group.name}</p>
          <ThumbGrid photos={entry.photos} onAdd={onAdd} />
        </div>
      ))}
      {loose.length > 0 ? (
        <div>
          {showLooseLabel ? <p className="px-1 pb-1 text-sm text-bark/60">Sin agrupar</p> : null}
          <ThumbGrid photos={loose} onAdd={onAdd} />
        </div>
      ) : null}
    </>
  )
}

function GroupedButtons<T extends { id: string; groupId: string | null }>({
  items,
  groups,
  label,
  onAdd,
}: {
  items: T[]
  groups: ItemGroup[]
  label: (item: T) => string
  onAdd: (item: T) => void
}) {
  const named = groups
    .map((group) => ({ group, items: items.filter((item) => item.groupId === group.id) }))
    .filter((entry) => entry.items.length > 0)
  const loose = items.filter((item) => item.groupId == null)
  const showLooseLabel = named.length > 0 && loose.length > 0
  return (
    <>
      {named.map((entry) => (
        <div key={entry.group.id} className="mb-2">
          <p className="px-1 pb-1 text-sm text-bark/60">{entry.group.name}</p>
          {entry.items.map((item) => (
            <ItemButton key={item.id} label={label(item)} onClick={() => onAdd(item)} />
          ))}
        </div>
      ))}
      {loose.map((item) => (
        <div key={item.id}>
          {showLooseLabel && item.id === loose[0]?.id ? <p className="px-1 pb-1 text-sm text-bark/60">Sin agrupar</p> : null}
          <ItemButton label={label(item)} onClick={() => onAdd(item)} />
        </div>
      ))}
    </>
  )
}

function ThumbGrid({ photos, onAdd }: { photos: Photo[]; onAdd: (photo: Photo) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <button key={photo.id} type="button" className="border border-line bg-paper" title={photo.name} onClick={() => onAdd(photo)}>
          <img src={`/api/photos/${photo.id}/thumbnail`} alt={photo.name} className="aspect-[3/4] w-full object-cover" />
        </button>
      ))}
    </div>
  )
}

function Section({
  title,
  action,
  onAction,
  defaultOpen,
  children,
}: {
  title: string
  action?: string
  onAction?: () => void
  defaultOpen: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={`text-sm ${open ? "text-bark" : "text-bark/60"}`}
        >
          {title}
        </button>
        {action && onAction ? (
          <button type="button" className="text-sm text-ink underline" onClick={onAction}>
            {action}
          </button>
        ) : null}
      </div>
      {open ? <div className="flex flex-col gap-1">{children}</div> : null}
    </section>
  )
}

function ItemButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="truncate px-1 py-1 text-left text-sm hover:bg-bark/5">
      {label}
    </button>
  )
}

function AddPool({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-1 border border-dashed border-ink/40 px-2 py-1 text-left text-sm">
      {label}
    </button>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-bark/60">{children}</p>
}
