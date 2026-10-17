import type { ReactNode } from "react"
import type { BookmarkElement } from "../domain/document"
import type { BibleText, Identity, Photo, Quote } from "../domain/models"
import { activeDocument, useEditorStore } from "./store"

type Libraries = {
  photos: Photo[]
  quotes: Quote[]
  bibleTexts: BibleText[]
  identities: Identity[]
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

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto border-r border-line bg-foam px-4 py-4">
      <Section title="Fotos" action="Subir" onAction={onCreatePhoto}>
        {libraries.photos.length === 0 ? <Hint>Sube una foto para encajarla en el marco.</Hint> : null}
        <div className="grid grid-cols-3 gap-2">
          {libraries.photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="border border-line bg-paper"
              title={photo.name}
              onClick={() =>
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
            >
              <img src={`/api/photos/${photo.id}/thumbnail`} alt={photo.name} className="aspect-[3/4] w-full object-cover" />
            </button>
          ))}
        </div>
      </Section>
      <Section title="Citas" action="Nueva" onAction={onCreateQuote}>
        <AddPool
          label="Caja dinámica"
          onClick={() => addElement(quoteElement(draft.widthMm, draft.heightMm, "pool", null), "front")}
        />
        {libraries.quotes.map((quote) => (
          <ItemButton
            key={quote.id}
            label={quote.body}
            onClick={() => addElement(quoteElement(draft.widthMm, draft.heightMm, "fixed", quote.id), "front")}
          />
        ))}
      </Section>
      <Section title="Textos bíblicos" action="Nuevo" onAction={onCreateBible}>
        <AddPool
          label="Caja dinámica"
          onClick={() => addElement(bibleElement(draft.widthMm, draft.heightMm, "pool", null), "front")}
        />
        {libraries.bibleTexts.map((text) => (
          <ItemButton
            key={text.id}
            label={`${text.book} ${text.chapter}:${text.verseStart}`}
            onClick={() => addElement(bibleElement(draft.widthMm, draft.heightMm, "fixed", text.id), "front")}
          />
        ))}
      </Section>
      <Section title="Identidad" action="Título" onAction={onCreateWordmark}>
        <button type="button" className="text-left text-sm text-ink underline" onClick={onCreateLogo}>
          Subir logo
        </button>
        {libraries.identities.map((item) => (
          <ItemButton
            key={item.id}
            label={item.kind === "logo" ? item.name : item.text}
            onClick={() => addElement(identityElement(item, draft.widthMm, draft.heightMm), "front")}
          />
        ))}
      </Section>
      <Section title="En esta cara">
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

function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string
  action?: string
  onAction?: () => void
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm">{title}</h2>
        {action && onAction ? (
          <button type="button" className="text-sm text-ink underline" onClick={onAction}>
            {action}
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
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
