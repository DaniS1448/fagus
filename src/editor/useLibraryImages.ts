import { useEffect, useState } from "react"
import type { Identity, Photo } from "../domain/models"
import { loadHtmlImage } from "../media"

export function useLibraryImages(photos: Photo[] | undefined, identities: Identity[] | undefined) {
  const [images, setImages] = useState<ReadonlyMap<string, HTMLImageElement>>(new Map())
  const photoKey = photos?.map((photo) => photo.id).join(",") ?? ""
  const identityKey = identities?.map((item) => `${item.id}:${item.updatedAt}`).join(",") ?? ""

  useEffect(() => {
    let cancelled = false
    const jobs: Array<Promise<readonly [string, HTMLImageElement] | null>> = []
    for (const photo of photos ?? []) {
      jobs.push(
        loadHtmlImage(`/api/photos/${photo.id}/file`)
          .then((image) => [photo.id, image] as const)
          .catch(() => null),
      )
    }
    for (const item of identities ?? []) {
      if (item.kind !== "logo") continue
      jobs.push(
        loadHtmlImage(`/api/identities/${item.id}/file`)
          .then((image) => [item.id, image] as const)
          .catch(() => null),
      )
    }
    void Promise.all(jobs).then((entries) => {
      if (cancelled) return
      const next = new Map<string, HTMLImageElement>()
      for (const entry of entries) {
        if (entry) next.set(entry[0], entry[1])
      }
      setImages(next)
    })
    return () => {
      cancelled = true
    }
  }, [photoKey, identityKey, photos, identities])

  return images
}
