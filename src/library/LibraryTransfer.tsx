import { useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { downloadFile, uploadForm } from "../api"
import { libraryFilename, type LibraryScope } from "../domain/portable"
import { downloadBlob } from "../media"
import { Button } from "../ui/controls"
import { TransferDialog, useTransfer } from "../ui/TransferDialog"

const labels: Record<LibraryScope, { export: string; import: string }> = {
  all: { export: "Exportar bibliotecas", import: "Importar bibliotecas" },
  quotes: { export: "Exportar", import: "Importar" },
  bible: { export: "Exportar", import: "Importar" },
  identities: { export: "Exportar", import: "Importar" },
  photos: { export: "Exportar", import: "Importar" },
}

const titles: Record<LibraryScope, { export: string; import: string }> = {
  all: { export: "Exportar bibliotecas", import: "Importar bibliotecas" },
  quotes: { export: "Exportar citas", import: "Importar citas" },
  bible: { export: "Exportar textos", import: "Importar textos" },
  identities: { export: "Exportar identidad", import: "Importar identidad" },
  photos: { export: "Exportar fotos", import: "Importar fotos" },
}

const libraryKeys = ["quotes", "bible", "identities", "photos", "photo-groups", "quote-groups", "bible-groups", "identity-groups"]

export function LibraryTransfer({ scope, group }: { scope: LibraryScope; group?: { id: string; name: string } }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { transfer, run, close } = useTransfer()
  const copy = labels[scope]
  const title = titles[scope]
  const busy = transfer !== null

  function exportLibrary() {
    const path = group
      ? `/api/library/export?scope=${scope}&group=${encodeURIComponent(group.id)}`
      : `/api/library/export?scope=${scope}`
    void run(group ? "Exportar agrupación" : title.export, "preparing", "No se pudo exportar", async (onProgress) => {
      const blob = await downloadFile(path, onProgress)
      downloadBlob(blob, libraryFilename(scope, group?.name))
    })
  }

  function importLibrary(file: File) {
    const body = new FormData()
    body.set("file", file)
    void run(title.import, "uploading", "No se pudo importar", async (onProgress) => {
      await uploadForm<void>(`/api/library/import?scope=${scope}`, body, onProgress)
      await Promise.all(libraryKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="quiet" disabled={busy} onClick={exportLibrary}>
        {group ? "Exportar agrupación" : copy.export}
      </Button>
      {group ? null : (
        <>
          <Button variant="quiet" disabled={busy} onClick={() => fileRef.current?.click()}>
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
              if (file) importLibrary(file)
            }}
          />
        </>
      )}
      {transfer ? (
        <TransferDialog
          title={transfer.title}
          phase={transfer.phase}
          loaded={transfer.loaded}
          total={transfer.total}
          error={transfer.error}
          onClose={close}
        />
      ) : null}
    </div>
  )
}
