import { describe, expect, it } from "vitest"
import { emptySide, textStyle, type SideDocument } from "./document"
import { remapSide, selectionForDesigns } from "./portable"

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
      },
    ],
  }
}

const libraries = {
  quotes: [{ id: "q-a" }, { id: "q-b" }],
  bibleTexts: [{ id: "b1" }, { id: "b2" }],
  photos: [
    { id: "photo-1", groupId: "group-1" },
    { id: "photo-2", groupId: null },
  ],
}

describe("selectionForDesigns", () => {
  it("takes the whole quote library when a dynamic box is open", () => {
    const selection = selectionForDesigns([quoteSide("pool", null, [])], libraries)
    expect(selection.quoteIds).toEqual(["q-a", "q-b"])
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
