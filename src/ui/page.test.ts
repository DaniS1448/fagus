import { describe, expect, it } from "vitest"
import { clampPage, pageCount, slicePage } from "./page"

const items = ["a", "b", "c", "d", "e"]

describe("page", () => {
  it("returns the first page", () => {
    expect(pageCount(5, 2)).toBe(3)
    expect(slicePage(items, 1, 2)).toEqual(["a", "b"])
  })

  it("returns a later page", () => {
    expect(slicePage(items, 2, 2)).toEqual(["c", "d"])
    expect(slicePage(items, 3, 2)).toEqual(["e"])
  })

  it("clamps a page past the end", () => {
    expect(clampPage(9, 5, 2)).toBe(3)
    expect(slicePage(items, 9, 2)).toEqual(["e"])
  })

  it("returns an empty slice for an empty list", () => {
    expect(pageCount(0, 12)).toBe(1)
    expect(clampPage(3, 0, 12)).toBe(1)
    expect(slicePage([], 3, 12)).toEqual([])
  })
})
