import { useState } from "react"

export const PAGE_SIZE = {
  projects: 12,
  designs: 12,
  library: 20,
  photos: 24,
} as const

export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0 || total <= 0) return 1
  return Math.ceil(total / pageSize)
}

export function clampPage(page: number, total: number, pageSize: number): number {
  const pages = pageCount(total, pageSize)
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.min(Math.floor(page), pages)
}

export function slicePage<T>(items: readonly T[], page: number, pageSize: number): T[] {
  if (pageSize <= 0 || items.length === 0) return []
  const current = clampPage(page, items.length, pageSize)
  const start = (current - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function usePagedList<T>(items: readonly T[], pageSize: number, resetKey: unknown) {
  const [page, setPage] = useState(1)
  const [prevKey, setPrevKey] = useState(resetKey)
  const current = clampPage(page, items.length, pageSize)
  if (prevKey !== resetKey) {
    setPrevKey(resetKey)
    setPage(1)
  } else if (page !== current) {
    setPage(current)
  }
  return {
    page: prevKey !== resetKey ? 1 : current,
    pages: pageCount(items.length, pageSize),
    items: slicePage(items, prevKey !== resetKey ? 1 : current, pageSize),
    setPage,
    total: items.length,
  }
}
