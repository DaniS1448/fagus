import { create } from "zustand"
import type { BookmarkElement, SideDocument } from "../domain/document"
import type { Design } from "../domain/models"

export type SideName = "front" | "back"

type Frame = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

type EditorState = {
  draft: Design | null
  past: Design[]
  future: Design[]
  side: SideName
  selectedId: string | null
  guides: boolean
  hydrate: (design: Design) => void
  setSide: (side: SideName) => void
  toggleGuides: () => void
  select: (id: string | null) => void
  beginGesture: () => void
  endGesture: () => void
  commit: (recipe: (design: Design) => Design) => void
  live: (recipe: (design: Design) => Design) => void
  patchSelected: (recipe: (element: BookmarkElement) => BookmarkElement, mode?: "commit" | "live") => void
  addElement: (element: BookmarkElement, placement: "back" | "front") => void
  commitFrame: (id: string, frame: Frame) => void
  removeSelected: () => void
  reorder: (id: string, direction: "front" | "back") => void
  undo: () => void
  redo: () => void
}

let gestureBase: Design | null = null

function sideDocument(design: Design, side: SideName): SideDocument {
  return side === "front" ? design.front : design.back
}

function withSide(design: Design, side: SideName, document: SideDocument): Design {
  if (side === "front") return { ...design, front: document }
  return { ...design, back: document }
}

function updateElement(
  design: Design,
  side: SideName,
  id: string,
  recipe: (element: BookmarkElement) => BookmarkElement,
): Design {
  const document = sideDocument(design, side)
  return withSide(design, side, {
    ...document,
    elements: document.elements.map((element) => (element.id === id ? recipe(element) : element)),
  })
}

function pushHistory(past: Design[], entry: Design): Design[] {
  return [...past, entry].slice(-40)
}

export const useEditorStore = create<EditorState>((set, get) => ({
  draft: null,
  past: [],
  future: [],
  side: "front",
  selectedId: null,
  guides: true,
  hydrate: (design) => {
    gestureBase = null
    set({ draft: structuredClone(design), past: [], future: [], side: "front", selectedId: null })
  },
  setSide: (side) => set({ side, selectedId: null }),
  toggleGuides: () => set({ guides: !get().guides }),
  select: (selectedId) => set({ selectedId }),
  beginGesture: () => {
    const draft = get().draft
    if (!draft || gestureBase) return
    gestureBase = draft
  },
  endGesture: () => {
    const draft = get().draft
    const base = gestureBase
    gestureBase = null
    if (!draft || !base || JSON.stringify(base) === JSON.stringify(draft)) return
    set({ past: pushHistory(get().past, base), future: [] })
  },
  commit: (recipe) => {
    const draft = get().draft
    if (!draft) return
    const base = gestureBase ?? draft
    gestureBase = null
    const next = recipe(draft)
    if (JSON.stringify(base) === JSON.stringify(next)) {
      set({ draft: next })
      return
    }
    set({ draft: next, past: pushHistory(get().past, base), future: [] })
  },
  live: (recipe) => {
    const draft = get().draft
    if (!draft) return
    if (!gestureBase) gestureBase = draft
    set({ draft: recipe(draft) })
  },
  patchSelected: (recipe, mode = "commit") => {
    const { draft, side, selectedId } = get()
    if (!draft || !selectedId) return
    const apply = mode === "live" ? get().live : get().commit
    apply((current) => updateElement(current, side, selectedId, recipe))
  },
  addElement: (element, placement) => {
    const { draft, side, past } = get()
    if (!draft) return
    gestureBase = null
    const document = sideDocument(draft, side)
    const elements = placement === "back" ? [element, ...document.elements] : [...document.elements, element]
    set({
      draft: withSide(draft, side, { ...document, elements }),
      past: pushHistory(past, draft),
      future: [],
      selectedId: element.id,
    })
  },
  commitFrame: (id, frame) => {
    get().commit((design) =>
      updateElement(design, get().side, id, (element) => ({
        ...element,
        ...frame,
      })),
    )
  },
  removeSelected: () => {
    const { draft, side, selectedId, past } = get()
    if (!draft || !selectedId) return
    const document = sideDocument(draft, side)
    set({
      draft: withSide(draft, side, {
        ...document,
        elements: document.elements.filter((element) => element.id !== selectedId),
      }),
      past: pushHistory(past, draft),
      future: [],
      selectedId: null,
    })
  },
  reorder: (id, direction) => {
    get().commit((design) => {
      const document = sideDocument(design, get().side)
      const index = document.elements.findIndex((element) => element.id === id)
      if (index < 0) return design
      const elements = document.elements.slice()
      const [item] = elements.splice(index, 1)
      if (!item) return design
      if (direction === "front") elements.push(item)
      else elements.unshift(item)
      return withSide(design, get().side, { ...document, elements })
    })
  },
  undo: () => {
    gestureBase = null
    const { past, draft, future } = get()
    const previous = past[past.length - 1]
    if (!draft || !previous) return
    set({ draft: previous, past: past.slice(0, -1), future: [draft, ...future].slice(0, 40) })
  },
  redo: () => {
    gestureBase = null
    const { past, draft, future } = get()
    const next = future[0]
    if (!draft || !next) return
    set({ draft: next, past: pushHistory(past, draft), future: future.slice(1) })
  },
}))

export function activeDocument(design: Design, side: SideName): SideDocument {
  return sideDocument(design, side)
}
