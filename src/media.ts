export async function prepareImage(file: File): Promise<{
  file: File
  thumbnail: Blob
  width: number
  height: number
}> {
  const bitmap = await createImageBitmap(file)
  const width = bitmap.width
  const height = bitmap.height
  const maxEdge = 320
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    throw new Error("No se pudo preparar la miniatura")
  }
  context.fillStyle = "#F4F0E6"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const thumbnail = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo crear la miniatura"))),
      "image/jpeg",
      0.82,
    )
  })
  return { file, thumbnail, width, height }
}

export function imageForm(
  prepared: Awaited<ReturnType<typeof prepareImage>>,
  name: string,
  groupId?: string | null,
  extra?: { kind?: string; text?: string; layout?: string },
): FormData {
  const body = new FormData()
  body.set("file", prepared.file)
  body.set("thumbnail", prepared.thumbnail, "thumbnail.jpg")
  body.set("widthPx", String(prepared.width))
  body.set("heightPx", String(prepared.height))
  body.set("name", name)
  if (groupId) body.set("groupId", groupId)
  if (extra?.kind) body.set("kind", extra.kind)
  if (extra?.text !== undefined) body.set("text", extra.text)
  if (extra?.layout) body.set("layout", extra.layout)
  return body
}

export function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("No se pudo cargar la imagen"))
    image.src = url
  })
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return slug || "marcapaginas"
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
