import type { BookmarkElement, TextStyle } from "../domain/document"
import { BOOKMARK_FONTS } from "../domain/fonts"
import type { BibleText, Identity, Photo, Quote } from "../domain/models"
import type { ResolvedElement } from "../domain/resolve"
import { Button, Field, Select } from "../ui/controls"
import { activeDocument, useEditorStore } from "./store"

type Libraries = {
  photos: Photo[]
  quotes: Quote[]
  bibleTexts: BibleText[]
  identities: Identity[]
}

export function Properties({
  libraries,
  resolved,
}: {
  libraries: Libraries
  resolved: ResolvedElement | null
}) {
  const draft = useEditorStore((state) => state.draft)
  const side = useEditorStore((state) => state.side)
  const selectedId = useEditorStore((state) => state.selectedId)
  const patchSelected = useEditorStore((state) => state.patchSelected)
  const beginGesture = useEditorStore((state) => state.beginGesture)
  const endGesture = useEditorStore((state) => state.endGesture)
  const removeSelected = useEditorStore((state) => state.removeSelected)
  const reorder = useEditorStore((state) => state.reorder)
  if (!draft || !selectedId) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-bark/70">Selecciona un elemento del marcapáginas para ajustar su marco, su texto o su foto.</p>
        {draft ? <BackgroundField /> : null}
      </div>
    )
  }
  const element = activeDocument(draft, side).elements.find((item) => item.id === selectedId)
  if (!element) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-bark/70">Ese elemento ya no está en esta cara.</p>
        <BackgroundField />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" onClick={() => reorder(element.id, "front")}>
          Traer al frente
        </Button>
        <Button variant="quiet" onClick={() => reorder(element.id, "back")}>
          Enviar atrás
        </Button>
        <Button variant="danger" onClick={removeSelected}>
          Quitar
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={element.x} onChange={(x) => patchSelected((item) => ({ ...item, x }), "live")} begin={beginGesture} end={endGesture} />
        <NumberField label="Y" value={element.y} onChange={(y) => patchSelected((item) => ({ ...item, y }), "live")} begin={beginGesture} end={endGesture} />
        <NumberField label="Ancho" value={element.width} min={4} onChange={(width) => patchSelected((item) => ({ ...item, width }), "live")} begin={beginGesture} end={endGesture} />
        <NumberField label="Alto" value={element.height} min={4} onChange={(height) => patchSelected((item) => ({ ...item, height }), "live")} begin={beginGesture} end={endGesture} />
        <NumberField label="Rotación" value={element.rotation} step={1} onChange={(rotation) => patchSelected((item) => ({ ...item, rotation }), "live")} begin={beginGesture} end={endGesture} />
      </div>
      <ElementFields
        element={element}
        libraries={libraries}
        resolved={resolved}
        onPatch={patchSelected}
        begin={beginGesture}
        end={endGesture}
      />
      <BackgroundField />
    </div>
  )
}

function BackgroundField() {
  const draft = useEditorStore((state) => state.draft)
  const side = useEditorStore((state) => state.side)
  const commit = useEditorStore((state) => state.commit)
  if (!draft) return null
  return (
    <Field label="Fondo de la cara">
      <input
        type="color"
        value={activeDocument(draft, side).background}
        onChange={(event) => {
          const background = event.target.value
          commit((design) => {
            const document = side === "front" ? design.front : design.back
            const next = { ...document, background }
            return side === "front" ? { ...design, front: next } : { ...design, back: next }
          })
        }}
      />
    </Field>
  )
}

function ElementFields({
  element,
  libraries,
  resolved,
  onPatch,
  begin,
  end,
}: {
  element: BookmarkElement
  libraries: Libraries
  resolved: ResolvedElement | null
  onPatch: (recipe: (element: BookmarkElement) => BookmarkElement, mode?: "commit" | "live") => void
  begin: () => void
  end: () => void
}) {
  switch (element.type) {
    case "photo":
      return (
        <>
          <Field label="Foto">
            <Select
              value={element.photoId}
              onChange={(event) => onPatch(() => ({ ...element, photoId: event.target.value }))}
            >
              {libraries.photos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  {photo.name}
                </option>
              ))}
            </Select>
          </Field>
          <FitFields element={element} onPatch={onPatch} begin={begin} end={end} />
        </>
      )
    case "quote":
      return (
        <>
          <Binding
            mode={element.mode}
            onMode={(mode) =>
              onPatch(() => ({
                ...element,
                mode,
                quoteId: mode === "fixed" ? element.quoteId ?? libraries.quotes[0]?.id ?? null : null,
              }))
            }
          />
          {element.mode === "fixed" ? (
            <Field label="Cita">
              <Select
                value={element.quoteId ?? ""}
                onChange={(event) => onPatch(() => ({ ...element, quoteId: event.target.value || null }))}
              >
                <option value="">Elige una cita</option>
                {libraries.quotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.body.slice(0, 80)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <PoolList
              items={libraries.quotes.map((quote) => ({ id: quote.id, label: quote.body }))}
              selected={element.poolIds}
              onChange={(poolIds) => onPatch(() => ({ ...element, poolIds }))}
            />
          )}
          <LockButton
            visible={element.mode === "pool" && resolved?.type === "quote" && !resolved.broken}
            onLock={() => {
              if (resolved?.type !== "quote" || !resolved.sourceId) return
              onPatch(() => ({ ...element, mode: "fixed", quoteId: resolved.sourceId }))
            }}
          />
          <StyleFields style={element.style} onChange={(style, mode) => onPatch(() => ({ ...element, style }), mode)} begin={begin} end={end} />
        </>
      )
    case "bible":
      return (
        <>
          <Binding
            mode={element.mode}
            onMode={(mode) =>
              onPatch(() => ({
                ...element,
                mode,
                bibleTextId: mode === "fixed" ? element.bibleTextId ?? libraries.bibleTexts[0]?.id ?? null : null,
              }))
            }
          />
          {element.mode === "fixed" ? (
            <Field label="Texto">
              <Select
                value={element.bibleTextId ?? ""}
                onChange={(event) => onPatch(() => ({ ...element, bibleTextId: event.target.value || null }))}
              >
                <option value="">Elige un texto</option>
                {libraries.bibleTexts.map((text) => (
                  <option key={text.id} value={text.id}>
                    {text.book} {text.chapter}:{text.verseStart}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <PoolList
              items={libraries.bibleTexts.map((text) => ({
                id: text.id,
                label: `${text.book} ${text.chapter}:${text.verseStart}`,
              }))}
              selected={element.poolIds}
              onChange={(poolIds) => onPatch(() => ({ ...element, poolIds }))}
            />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={element.showReference}
              onChange={(event) => onPatch(() => ({ ...element, showReference: event.target.checked }))}
            />
            Mostrar la referencia
          </label>
          <LockButton
            visible={element.mode === "pool" && resolved?.type === "bible" && !resolved.broken}
            onLock={() => {
              if (resolved?.type !== "bible" || !resolved.sourceId) return
              onPatch(() => ({ ...element, mode: "fixed", bibleTextId: resolved.sourceId }))
            }}
          />
          <StyleFields label="Texto" style={element.style} onChange={(style, mode) => onPatch(() => ({ ...element, style }), mode)} begin={begin} end={end} />
          <StyleFields
            label="Referencia"
            style={element.referenceStyle}
            onChange={(referenceStyle, mode) => onPatch(() => ({ ...element, referenceStyle }), mode)}
            begin={begin}
            end={end}
          />
        </>
      )
    case "identity": {
      const current = libraries.identities.find((item) => item.id === element.identityId)
      return (
        <>
          <Field label="Identidad">
            <Select
              value={element.identityId}
              onChange={(event) => onPatch(() => ({ ...element, identityId: event.target.value }))}
            >
              {libraries.identities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.kind === "logo" ? `${item.name} (logo)` : item.text}
                </option>
              ))}
            </Select>
          </Field>
          {current?.kind === "logo" ? (
            <FitFields element={element} onPatch={onPatch} begin={begin} end={end} />
          ) : (
            <StyleFields style={element.style} onChange={(style, mode) => onPatch(() => ({ ...element, style }), mode)} begin={begin} end={end} />
          )}
        </>
      )
    }
    default: {
      const unknown: never = element
      return unknown
    }
  }
}

function Binding({ mode, onMode }: { mode: "fixed" | "pool"; onMode: (mode: "fixed" | "pool") => void }) {
  return (
    <fieldset className="flex gap-4 text-sm">
      <legend className="mb-1">Uso</legend>
      <label className="flex items-center gap-2">
        <input type="radio" checked={mode === "fixed"} onChange={() => onMode("fixed")} />
        Fijo
      </label>
      <label className="flex items-center gap-2">
        <input type="radio" checked={mode === "pool"} onChange={() => onMode("pool")} />
        Dinámico
      </label>
    </fieldset>
  )
}

function PoolList({
  items,
  selected,
  onChange,
}: {
  items: Array<{ id: string; label: string }>
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <div>
      <p className="text-sm text-bark/70">Si no marcas ninguna, entra toda la biblioteca.</p>
      <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-auto">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => {
                  const next = selected.includes(item.id)
                    ? selected.filter((id) => id !== item.id)
                    : [...selected, item.id]
                  onChange(next)
                }}
              />
              <span className="line-clamp-2">{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LockButton({ visible, onLock }: { visible: boolean; onLock: () => void }) {
  if (!visible) return null
  return (
    <Button variant="paper" onClick={onLock}>
      Fijar este resultado
    </Button>
  )
}

function FitFields({
  element,
  onPatch,
  begin,
  end,
}: {
  element: { fit: "cover" | "contain"; scale: number; offsetX: number; offsetY: number }
  onPatch: (recipe: (element: BookmarkElement) => BookmarkElement, mode?: "commit" | "live") => void
  begin: () => void
  end: () => void
}) {
  return (
    <>
      <div className="flex gap-2">
        <Button variant={element.fit === "cover" ? "solid" : "quiet"} onClick={() => onPatch((item) => item.type === "quote" || item.type === "bible" ? item : { ...item, fit: "cover" })}>
          Rellenar
        </Button>
        <Button variant={element.fit === "contain" ? "solid" : "quiet"} onClick={() => onPatch((item) => item.type === "quote" || item.type === "bible" ? item : { ...item, fit: "contain" })}>
          Contener
        </Button>
      </div>
      <Range label="Acercar" min={0.5} max={3} step={0.01} value={element.scale} onChange={(scale) => onPatch((item) => ("scale" in item ? { ...item, scale } : item), "live")} begin={begin} end={end} />
      <Range label="Desplazar horizontal" min={-1} max={1} step={0.01} value={element.offsetX} onChange={(offsetX) => onPatch((item) => ("offsetX" in item ? { ...item, offsetX } : item), "live")} begin={begin} end={end} />
      <Range label="Desplazar vertical" min={-1} max={1} step={0.01} value={element.offsetY} onChange={(offsetY) => onPatch((item) => ("offsetY" in item ? { ...item, offsetY } : item), "live")} begin={begin} end={end} />
    </>
  )
}

function StyleFields({
  label = "Tipografía",
  style,
  onChange,
  begin,
  end,
}: {
  label?: string
  style: TextStyle
  onChange: (style: TextStyle, mode?: "commit" | "live") => void
  begin: () => void
  end: () => void
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="text-sm">{label}</h3>
      <Field label="Familia">
        <Select
          value={style.fontFamily}
          onChange={(event) => {
            const fontFamily = event.target.value
            if (fontFamily === "libre-baskerville" || fontFamily === "source-sans-3" || fontFamily === "barlow-condensed") {
              onChange({ ...style, fontFamily })
            }
          }}
        >
          {BOOKMARK_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </Select>
      </Field>
      <NumberField label="Cuerpo (mm)" value={style.fontSizeMm} min={1} step={0.1} onChange={(fontSizeMm) => onChange({ ...style, fontSizeMm }, "live")} begin={begin} end={end} />
      <Field label="Alineación">
        <Select
          value={style.align}
          onChange={(event) => {
            const align = event.target.value
            if (align === "left" || align === "center" || align === "right") onChange({ ...style, align })
          }}
        >
          <option value="left">Izquierda</option>
          <option value="center">Centro</option>
          <option value="right">Derecha</option>
        </Select>
      </Field>
      <Field label="Color">
        <input type="color" value={style.color} onChange={(event) => onChange({ ...style, color: event.target.value })} />
      </Field>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  begin,
  end,
  min,
  step = 0.1,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  begin: () => void
  end: () => void
  min?: number
  step?: number
}) {
  return (
    <Field label={label}>
      <input
        className="border border-line bg-white px-2 py-1 text-sm"
        type="number"
        value={round(value)}
        min={min}
        step={step}
        onFocus={begin}
        onBlur={end}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
      />
    </Field>
  )
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
  begin,
  end,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  begin: () => void
  end: () => void
}) {
  return (
    <Field label={label}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={begin}
        onPointerUp={end}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  )
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
