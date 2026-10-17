import { describe, expect, it } from "vitest"
import { emptyPlate, emptySide, textStyle, type SideDocument } from "./document"
import { includedLibraries, libraryFilename, remapGroupId, remapSide, selectionForDesigns } from "./portable"

function quoteSide(mode: "fixed" | "pool", quoteId: string | null, poolIds: string[]): SideDocument {
  return {
    ...emptySide(),
    elements: [
      {
        id: "q",
        type: "quote",
        mode,
        quoteId,
        poolIds,
        x: 0,
        y: 0,
        width: 40,
        height: 20,
        rotation: 0,
        style: textStyle(),
        gapMm: 2,
        plate: emptyPlate(),
      },
    ],
  }
}

const libraries = {
  quotes: [
    { id: "q-a", groupId: "qg" },
    { id: "q-b", groupId: null },
  ],
  bibleTexts: [{ id: "b1", groupId: "bg" }, { id: "b2", groupId: null }],
  identities: [{ id: "i1", groupId: "ig" }],
  photos: [
    { id: "photo-1", groupId: "group-1" },
    { id: "photo-2", groupId: null },
  ],
}

describe("selectionForDesigns", () => {
  it("takes the whole quote library when a dynamic box is open", () => {
    const selection = selectionForDesigns([quoteSide("pool", null, [])], libraries)
    expect(selection.quoteIds).toEqual(["q-a", "q-b"])
    expect(selection.quoteGroupIds).toEqual(["qg"])
  })

  it("takes only the marked quotes and the photo's group", () => {
    const side: SideDocument = {
      ...emptySide(),
      elements: [
        ...quoteSide("pool", null, ["q-b"]).elements,
        {
          id: "p",
          type: "photo",
          photoId: "photo-1",
          x: 0,
          y: 0,
          width: 50,
          height: 155,
          rotation: 0,
          fit: "cover",
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        },
      ],
    }
    const selection = selectionForDesigns([side], libraries)
    expect(selection.quoteIds).toEqual(["q-b"])
    expect(selection.photoIds).toEqual(["photo-1"])
    expect(selection.groupIds).toEqual(["group-1"])
    expect(selection.quoteGroupIds).toEqual([])
  })
})

describe("library bundles", () => {
  it("includes only the asked library", () => {
    expect(includedLibraries("quotes")).toEqual({
      quotes: true,
      bible: false,
      identities: false,
      photos: false,
    })
    expect(includedLibraries("all").photos).toBe(true)
  })

  it("names a section file and a single grouping file", () => {
    expect(libraryFilename("quotes")).toBe("citas.fagus")
    expect(libraryFilename("quotes", "Adviento")).toBe("citas-adviento.fagus")
    expect(libraryFilename("photos", "  ")).toBe("fotos-agrupacion.fagus")
  })

  it("rewrites a group id and drops one that did not travel", () => {
    const groups = new Map([["old", "new"]])
    expect(remapGroupId("old", groups)).toBe("new")
    expect(remapGroupId("missing", groups)).toBeNull()
    expect(remapGroupId(null, groups)).toBeNull()
  })
})

describe("remapSide", () => {
  it("rewrites library ids and leaves a missing one broken", () => {
    const side = remapSide(quoteSide("fixed", "q-a", []), {
      quotes: new Map([["q-a", "q-new"]]),
      bibleTexts: new Map(),
      identities: new Map(),
      photos: new Map([["photo-1", "photo-new"]]),
    })
    const quote = side.elements[0]
    if (quote?.type !== "quote") throw new Error("shape")
    expect(quote.quoteId).toBe("q-new")
  })
})
