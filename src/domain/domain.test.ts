import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"
import { emptyPlate, emptySide, parseSideDocument, textStyle, type SideDocument } from "./document"
import { impose, mirrorAxis } from "./impose"
import { alignFrame, photoPlacement, resizeKeepingRatio, snapAngle, snapFrame } from "./placement"
import { buildPdf } from "./pdf"
import { mixSeed } from "./random"
import { resolveDocument, type LibrarySnapshot } from "./resolve"

const libraries: LibrarySnapshot = {
  quotes: [
    { id: "q-b", body: "Segunda", attribution: "Ana" },
    { id: "q-a", body: "Primera", attribution: "Luis" },
  ],
  bibleTexts: [
    {
      id: "b1",
      book: "Juan",
      chapter: 3,
      verseStart: 16,
      verseEnd: null,
      body: "Porque de tal manera amó Dios al mundo.",
      translation: "RVR",
    },
    {
      id: "b2",
      book: "Salmos",
      chapter: 23,
      verseStart: 1,
      verseEnd: 3,
      body: "Jehová es mi pastor.",
      translation: "",
    },
  ],
  identities: [
    {
      id: "word",
      kind: "wordmark",
      layout: null,
      textShare: null,
      name: "Emaus 2027",
      text: "Emaus 2027",
      widthPx: null,
      heightPx: null,
    },
    {
      id: "logo",
      kind: "logo",
      layout: null,
      textShare: null,
      name: "Logo",
      text: "",
      widthPx: 400,
      heightPx: 400,
    },
    {
      id: "lock",
      kind: "lockup",
      layout: "row",
      textShare: 40,
      name: "Emaus",
      text: "Emaus",
      widthPx: 200,
      heightPx: 200,
    },
  ],
  photos: [{ id: "photo-1", widthPx: 1200, heightPx: 800 }],
}

function quoteDocument(
  partial: Partial<Extract<SideDocument["elements"][number], { type: "quote" }>> = {},
): SideDocument {
  return {
    ...emptySide(),
    elements: [
      {
        id: "el-1",
        type: "quote",
        mode: "fixed",
        quoteId: "q-a",
        poolIds: [],
        x: 0,
        y: 0,
        width: 40,
        height: 20,
        rotation: 0,
        style: textStyle(),
        gapMm: 2,
        plate: emptyPlate(),
        ...partial,
      },
    ],
  }
}

describe("resolveDocument", () => {
  it("keeps a fixed quote and formats a bible reference", () => {
    const side = resolveDocument(
      {
        ...emptySide(),
        elements: [
          ...quoteDocument().elements,
          {
            id: "el-2",
            type: "bible",
            mode: "fixed",
            bibleTextId: "b2",
            poolIds: [],
            showReference: true,
            x: 0,
            y: 0,
            width: 40,
            height: 30,
            rotation: 0,
            style: textStyle(),
            referenceStyle: textStyle(),
            gapMm: 2,
            plate: emptyPlate(),
          },
        ],
      },
      libraries,
      1,
    )
    const quote = side.elements[0]
    const bible = side.elements[1]
    if (quote?.type !== "quote" || bible?.type !== "bible") throw new Error("shape")
    expect(quote.text).toBe("Primera")
    expect(quote.sourceId).toBe("q-a")
    expect(bible.reference).toBe("Salmos 23:1-3")
    expect(side.broken).toBe(false)
  })

  it("draws a dynamic quote only from the selected pool and stays stable", () => {
    const document = quoteDocument({ mode: "pool", quoteId: null, poolIds: ["q-b"] })
    const first = resolveDocument(document, libraries, 7)
    const second = resolveDocument(document, libraries, 7)
    expect(first).toEqual(second)
    const quote = first.elements[0]
    if (quote?.type !== "quote") throw new Error("shape")
    expect(quote.sourceId).toBe("q-b")
  })

  it("treats an empty pool as the whole library", () => {
    const document = quoteDocument({ mode: "pool", quoteId: null, poolIds: [] })
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40; seed += 1) {
      const side = resolveDocument(document, libraries, seed)
      const quote = side.elements[0]
      if (quote?.type !== "quote") throw new Error("shape")
      if (quote.sourceId) seen.add(quote.sourceId)
    }
    expect(seen.has("q-a")).toBe(true)
    expect(seen.has("q-b")).toBe(true)
  })

  it("marks a missing fixed quote as broken instead of substituting another", () => {
    const side = resolveDocument(quoteDocument({ quoteId: "gone" }), libraries, 1)
    expect(side.broken).toBe(true)
    const quote = side.elements[0]
    if (quote?.type !== "quote") throw new Error("shape")
    expect(quote.sourceId).toBeNull()
  })

  it("passes a wordmark through and does not replace a missing identity", () => {
    const side = resolveDocument(
      {
        ...emptySide(),
        elements: [
          {
            id: "id-1",
            type: "identity",
            identityId: "word",
            x: 1,
            y: 2,
            width: 30,
            height: 8,
            rotation: 0,
            fit: "contain",
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            style: textStyle(),
            plate: emptyPlate(),
          },
          {
            id: "id-2",
            type: "identity",
            identityId: "missing",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            rotation: 0,
            fit: "contain",
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            style: textStyle(),
            plate: emptyPlate(),
          },
        ],
      },
      libraries,
      3,
    )
    const word = side.elements[0]
    const missing = side.elements[1]
    if (word?.type !== "identity" || missing?.type !== "identity") throw new Error("shape")
    expect(word.kind).toBe("wordmark")
    expect(word.text).toBe("Emaus 2027")
    expect(word.broken).toBe(false)
    expect(missing.kind).toBe("missing")
    expect(missing.broken).toBe(true)
    expect(side.broken).toBe(true)
  })

  it("resolves a lockup with its text, image, and layout", () => {
    const side = resolveDocument(
      {
        ...emptySide(),
        elements: [
          {
            id: "id-lock",
            type: "identity",
            identityId: "lock",
            x: 1,
            y: 2,
            width: 40,
            height: 16,
            rotation: 0,
            fit: "contain",
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            style: textStyle(),
            plate: emptyPlate(),
          },
        ],
      },
      libraries,
      4,
    )
    const lock = side.elements[0]
    if (lock?.type !== "identity") throw new Error("shape")
    expect(lock.kind).toBe("lockup")
    expect(lock.text).toBe("Emaus")
    expect(lock.imageId).toBe("lock")
    expect(lock.layout).toBe("row")
    expect(lock.textShare).toBe(40)
    expect(lock.broken).toBe(false)
  })
})

describe("resizeKeepingRatio", () => {
  const box = { x: 10, y: 20, width: 40, height: 20, rotation: 0 }

  it("scales both axes from a side handle and keeps the opposite edge", () => {
    const next = resizeKeepingRatio(box, { ...box, width: 80 }, "middle-right")
    expect(next.width).toBeCloseTo(80)
    expect(next.height).toBeCloseTo(40)
    expect(next.x).toBeCloseTo(10)
    expect(next.y).toBeCloseTo(10)
  })

  it("scales both axes from the bottom and keeps the top edge", () => {
    const next = resizeKeepingRatio(box, { ...box, height: 40 }, "bottom-center")
    expect(next.width).toBeCloseTo(80)
    expect(next.height).toBeCloseTo(40)
    expect(next.x).toBeCloseTo(-10)
    expect(next.y).toBeCloseTo(20)
  })

  it("leaves corner boxes alone", () => {
    const proposed = { ...box, width: 80, height: 10 }
    expect(resizeKeepingRatio(box, proposed, "bottom-right")).toEqual(proposed)
  })

  it("keeps the fixed point when the box is rotated", () => {
    const rotated = { ...box, rotation: Math.PI / 2 }
    const next = resizeKeepingRatio(rotated, { ...rotated, width: 80 }, "middle-right")
    const before = worldPoint(rotated, 0, rotated.height / 2)
    const after = worldPoint(next, 0, next.height / 2)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(next.width).toBeCloseTo(80)
    expect(next.height).toBeCloseTo(40)
  })
})

function worldPoint(box: { x: number; y: number; rotation: number }, localX: number, localY: number) {
  const cos = Math.cos(box.rotation)
  const sin = Math.sin(box.rotation)
  return {
    x: box.x + localX * cos - localY * sin,
    y: box.y + localX * sin + localY * cos,
  }
}

describe("mixSeed", () => {
  it("changes with the copy index", () => {
    expect(mixSeed(12, 0)).not.toBe(mixSeed(12, 1))
    expect(mixSeed(12, 1)).toBe(mixSeed(12, 1))
  })
})

describe("photoPlacement", () => {
  it("covers the frame and pans to the edges", () => {
    const centered = photoPlacement({
      frameWidth: 50,
      frameHeight: 155,
      imageWidth: 200,
      imageHeight: 100,
      fit: "cover",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    })
    expect(centered.height).toBeCloseTo(155)
    expect(centered.width).toBeGreaterThan(50)
    expect(centered.x).toBeLessThan(0)

    const right = photoPlacement({
      frameWidth: 50,
      frameHeight: 155,
      imageWidth: 200,
      imageHeight: 100,
      fit: "cover",
      scale: 1,
      offsetX: 1,
      offsetY: 0,
    })
    expect(right.x + right.width).toBeCloseTo(50)
  })

  it("contains a logo inside the frame", () => {
    const placed = photoPlacement({
      frameWidth: 16,
      frameHeight: 16,
      imageWidth: 400,
      imageHeight: 200,
      fit: "contain",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    })
    expect(placed.width).toBeCloseTo(16)
    expect(placed.height).toBeCloseTo(8)
    expect(placed.y).toBeCloseTo(4)
  })
})

describe("snap", () => {
  it("snaps a frame to the page center and an angle to a right angle", () => {
    const snapped = snapFrame({ x: 14.7, y: 40, width: 20, height: 10 }, 50, 155)
    expect(snapped.x).toBeCloseTo(15)
    const aligned = alignFrame(
      { x: 9.6, y: 20, width: 10, height: 8 },
      { width: 50, height: 155 },
      [{ x: 12, y: 40, width: 6, height: 10 }],
    )
    expect(aligned.x).toBeCloseTo(10)
    expect(aligned.lines).toEqual([{ axis: "x", at: 15 }])
    expect(snapAngle(2)).toBe(0)
    expect(snapAngle(88)).toBe(90)
  })
})

describe("impose", () => {
  const options = {
    paper: "A4" as const,
    orientation: "portrait" as const,
    marginMm: 10,
    gapMm: 4,
    cropMarks: true,
    flip: "long" as const,
    duplex: true,
    bookmarkWidthMm: 50,
    bookmarkHeightMm: 155,
    bookmarkOrientation: "portrait" as const,
  }

  it("centers three bookmarks on a portrait A4 and mirrors columns for the back", () => {
    const items = [0, 1, 2, 3, 4].map((copyIndex) => ({ id: "design", copyIndex }))
    const result = impose(items, options)
    expect(result.fits).toBe(true)
    expect(result.perSheet).toBe(3)
    expect(result.sheets).toHaveLength(2)
    const front = result.sheets[0]?.front ?? []
    expect(front.map((cell) => [cell.xMm, cell.yMm])).toEqual([
      [26, 71],
      [80, 71],
      [134, 71],
    ])
    const back = result.sheets[0]?.back ?? []
    expect(back.map((cell) => cell.xMm)).toEqual([134, 80, 26])
    expect(back.map((cell) => cell.copyIndex)).toEqual([0, 1, 2])
    expect(result.sheets[0]?.frontCropMarks.length).toBeGreaterThan(0)
    expect(result.sheets[1]?.front).toHaveLength(2)
  })

  it("reports when the bookmark does not fit", () => {
    const result = impose([{ id: "design", copyIndex: 0 }], {
      ...options,
      bookmarkWidthMm: 400,
    })
    expect(result.fits).toBe(false)
    expect(result.sheets).toEqual([])
  })

  it("lays bookmarks on their side and keeps the back in the same turn", () => {
    const result = impose(
      [0, 1, 2, 3, 4].map((copyIndex) => ({ id: "design", copyIndex })),
      { ...options, bookmarkOrientation: "landscape" },
    )
    expect(result.perSheet).toBe(5)
    const front = result.sheets[0]?.front ?? []
    expect(front.map((cell) => [cell.widthMm, cell.heightMm, cell.rotation])).toEqual([
      [155, 50, 90],
      [155, 50, 90],
      [155, 50, 90],
      [155, 50, 90],
      [155, 50, 90],
    ])
    expect(front.map((cell) => cell.yMm)).toEqual([15.5, 69.5, 123.5, 177.5, 231.5])
    expect(result.sheets[0]?.back.every((cell) => cell.rotation === 90)).toBe(true)
  })

  it("mirrors rows when the long edge is horizontal", () => {
    expect(mirrorAxis(297, 210, "long")).toBe("y")
    expect(mirrorAxis(210, 297, "short")).toBe("y")
  })
})

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

describe("buildPdf", () => {
  it("sizes a bookmark page and an A4 sheet in points", async () => {
    const png = decodeBase64(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    )
    const bytes = await buildPdf([
      {
        widthMm: 50,
        heightMm: 155,
        images: [{ png, xMm: 0, yMm: 0, widthMm: 50, heightMm: 155 }],
        cropMarks: [],
      },
      {
        widthMm: 210,
        heightMm: 297,
        images: [{ png, xMm: 26, yMm: 71, widthMm: 50, heightMm: 155 }],
        cropMarks: [{ x1: 20, y1: 71, x2: 23, y2: 71 }],
      },
    ])
    const pdf = await PDFDocument.load(bytes)
    const [bookmark, sheet] = pdf.getPages()
    expect(bookmark?.getWidth()).toBeCloseTo((50 * 72) / 25.4, 2)
    expect(bookmark?.getHeight()).toBeCloseTo((155 * 72) / 25.4, 2)
    expect(sheet?.getWidth()).toBeCloseTo((210 * 72) / 25.4, 2)
    expect(sheet?.getHeight()).toBeCloseTo((297 * 72) / 25.4, 2)
  })
})

describe("parseSideDocument", () => {
  it("keeps an older text and gives it a 2 mm gap", () => {
    const parsed = parseSideDocument({
      background: "#F4F0E6",
      elements: [
        {
          id: "el-2",
          type: "bible",
          mode: "fixed",
          bibleTextId: "b1",
          poolIds: [],
          showReference: true,
          x: 0,
          y: 0,
          width: 40,
          height: 80,
          rotation: 0,
          style: textStyle(),
          referenceStyle: textStyle(),
        },
      ],
    })
    const element = parsed.elements[0]
    if (element?.type !== "bible") throw new Error("shape")
    expect(element.gapMm).toBe(2)
    expect(element.plate.color).toBeNull()
    expect(element.plate.paddingTopMm).toBe(1.5)
    expect(element.plate.radiusMm).toBe(0)
    expect(element.style.strokeColor).toBeNull()
    expect(element.style.strokeWidthMm).toBe(0)
    expect(parsed.elements).toHaveLength(1)
  })

  it("keeps each plate margin and turns an older single margin into four", () => {
    const parsed = parseSideDocument({
      background: "#F4F0E6",
      elements: [
        {
          id: "el-3",
          type: "bible",
          mode: "fixed",
          bibleTextId: "b1",
          poolIds: [],
          showReference: true,
          x: 0,
          y: 0,
          width: 40,
          height: 80,
          rotation: 0,
          style: textStyle(),
          referenceStyle: textStyle(),
          plate: { color: "#112233", opacity: 0.8, paddingMm: 2.2 },
        },
        {
          id: "el-4",
          type: "quote",
          mode: "fixed",
          quoteId: "q-a",
          poolIds: [],
          x: 0,
          y: 0,
          width: 40,
          height: 40,
          rotation: 0,
          style: textStyle(),
          plate: {
            color: "#AABBCC",
            opacity: 1,
            paddingTopMm: 1,
            paddingRightMm: 2,
            paddingBottomMm: 3,
            paddingLeftMm: 4,
            radiusMm: 2.5,
          },
        },
      ],
    })
    const older = parsed.elements[0]
    const newer = parsed.elements[1]
    if (older?.type !== "bible" || newer?.type !== "quote") throw new Error("shape")
    expect(older.plate.paddingTopMm).toBe(2.2)
    expect(older.plate.paddingRightMm).toBe(2.2)
    expect(older.plate.paddingBottomMm).toBe(2.2)
    expect(older.plate.paddingLeftMm).toBe(2.2)
    expect(older.plate.radiusMm).toBe(0)
    expect(newer.plate.paddingTopMm).toBe(1)
    expect(newer.plate.paddingRightMm).toBe(2)
    expect(newer.plate.paddingBottomMm).toBe(3)
    expect(newer.plate.paddingLeftMm).toBe(4)
    expect(newer.plate.radiusMm).toBe(2.5)
  })
})
