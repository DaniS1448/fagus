import type { BibleText, Design, Identity, Photo, Project, Quote } from "./domain/models"

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (response.status === 204) return undefined as T
  const text = await response.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "No se pudo completar la acción"
    throw new ApiError(message)
  }
  return data as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request(path)
}

export function apiJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  return request(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function apiForm<T>(path: string, method: string, body: FormData): Promise<T> {
  return request(path, { method, body })
}

export type { BibleText, Design, Identity, Photo, Project, Quote }
