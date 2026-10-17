import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { ApiError, apiForm } from "../api"
import type { LibraryScope } from "../domain/portable"
import { downloadBlob } from "../media"
import { Button, Notice } from "../ui/controls"

const labels: Record<LibraryScope, { export: string; import: string; filename: string }> = {
  all: { export: "Exportar bibliotecas", import: "Importar bibliotecas", filename: "bibliotecas.fagus" },
  quotes: { export: "Exportar", import: "Importar", filename: "citas.fagus" },
  bible: { export: "Exportar", import: "Importar", filename: "textos.fagus" },
  identities: { export: "Exportar", import: "Importar", filename: "identidad.fagus" },
  photos: { export: "Exportar", import: "Importar", filename: "fotos.fagus" },
}

const libraryKeys = ["quotes", "bible", "identities", "photos", "photo-groups", "quote-groups", "bible-groups", "identity-groups"]

export function LibraryTransfer({ scope }: { scope: LibraryScope }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const copy = labels[scope]

  const download = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/library/export?scope=${scope}`)
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null)
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "No se pudo exportar"
        throw new ApiError(message)
      }
      downloadBlob(await response.blob(), copy.filename)
    },
    onSuccess: () => setError(null),
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo exportar"),
  })

  const importFile = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData()
      body.set("file", file)
      return apiForm<void>(`/api/library/import?scope=${scope}`, "POST", body)
    },
    onSuccess: async () => {
      setError(null)
      await Promise.all(libraryKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo importar"),
  })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="quiet" disabled={download.isPending} onClick={() => download.mutate()}>
        {copy.export}
      </Button>
      <Button variant="quiet" disabled={importFile.isPending} onClick={() => fileRef.current?.click()}>
        {copy.import}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".fagus"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) importFile.mutate(file)
        }}
      />
      {error ? <Notice>{error}</Notice> : null}
    </div>
  )
}
