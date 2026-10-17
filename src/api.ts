import type { BibleText, Design, Identity, Photo, Project, Quote } from "./domain/models"

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiError"
  }
}

export type TransferProgress = {
  phase: "uploading" | "preparing" | "saving" | "downloading"
  loaded: number
  total: number | null
}

const FAILED = "No se pudo completar la acción"

function errorMessage(data: unknown): string | null {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error
  }
  return null
}

function parsePayload(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (response.status === 204) return undefined as T
  const data = parsePayload(await response.text())
  if (!response.ok) throw new ApiError(errorMessage(data) ?? FAILED)
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

export function uploadForm<T>(
  path: string,
  body: FormData,
  onProgress: (progress: TransferProgress) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", path)
    xhr.upload.onprogress = (event) => {
      onProgress({
        phase: "uploading",
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : null,
      })
    }
    xhr.upload.onload = () => {
      onProgress({ phase: "saving", loaded: 0, total: null })
    }
    xhr.onload = () => {
      const data = parsePayload(xhr.responseText)
      if (xhr.status === 204) {
        resolve(undefined as T)
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(errorMessage(data) ?? FAILED))
        return
      }
      resolve(data as T)
    }
    xhr.onerror = () => reject(new ApiError(FAILED))
    xhr.send(body)
  })
}

export function downloadFile(path: string, onProgress: (progress: TransferProgress) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("GET", path)
    xhr.responseType = "blob"
    onProgress({ phase: "preparing", loaded: 0, total: null })
    xhr.onprogress = (event) => {
      onProgress({
        phase: "downloading",
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : null,
      })
    }
    xhr.onload = () => {
      const blob = xhr.response as Blob
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(blob)
        return
      }
      void blob
        .text()
        .then((text) => reject(new ApiError(errorMessage(parsePayload(text)) ?? FAILED)))
        .catch(() => reject(new ApiError(FAILED)))
    }
    xhr.onerror = () => reject(new ApiError(FAILED))
    xhr.send()
  })
}

export type { BibleText, Design, Identity, Photo, Project, Quote }
