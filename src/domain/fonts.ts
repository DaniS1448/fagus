export const BOOKMARK_FONTS = [
  { id: "libre-baskerville", label: "Libre Baskerville", css: '"Libre Baskerville", serif' },
  { id: "source-sans-3", label: "Source Sans 3", css: '"Source Sans 3", sans-serif' },
  { id: "barlow-condensed", label: "Barlow Condensed", css: '"Barlow Condensed", sans-serif' },
] as const

export type BookmarkFontId = (typeof BOOKMARK_FONTS)[number]["id"]

export function fontCss(id: BookmarkFontId): string {
  switch (id) {
    case "libre-baskerville":
      return '"Libre Baskerville", serif'
    case "source-sans-3":
      return '"Source Sans 3", sans-serif'
    case "barlow-condensed":
      return '"Barlow Condensed", sans-serif'
    default: {
      const unknown: never = id
      return unknown
    }
  }
}

export function fontLabel(id: BookmarkFontId): string {
  switch (id) {
    case "libre-baskerville":
      return "Libre Baskerville"
    case "source-sans-3":
      return "Source Sans 3"
    case "barlow-condensed":
      return "Barlow Condensed"
    default: {
      const unknown: never = id
      return unknown
    }
  }
}
