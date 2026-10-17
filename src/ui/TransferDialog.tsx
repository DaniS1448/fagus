import { useState } from "react"
import { ApiError, type TransferProgress } from "../api"
import { Button, Notice } from "./controls"

export type TransferPhase = TransferProgress["phase"] | "done" | "error"

type TransferState = {
  title: string
  phase: TransferPhase
  loaded: number
  total: number | null
  error: string | null
}

const phaseLabel: Record<TransferPhase, string> = {
  uploading: "Subiendo el archivo",
  preparing: "Preparando el archivo",
  saving: "Guardando en Fagus",
  downloading: "Descargando",
  done: "Listo",
  error: "No se pudo completar",
}

const DONE_MS = 700

export function useTransfer() {
  const [transfer, setTransfer] = useState<TransferState | null>(null)

  async function run(
    title: string,
    phase: "uploading" | "preparing",
    fallback: string,
    task: (onProgress: (progress: TransferProgress) => void) => Promise<void>,
  ): Promise<boolean> {
    setTransfer({ title, phase, loaded: 0, total: null, error: null })
    try {
      await task((progress) => {
        setTransfer((current) =>
          current
            ? { ...current, phase: progress.phase, loaded: progress.loaded, total: progress.total, error: null }
            : current,
        )
      })
      setTransfer((current) => (current ? { ...current, phase: "done", error: null } : current))
      await new Promise((resolve) => window.setTimeout(resolve, DONE_MS))
      setTransfer(null)
      return true
    } catch (reason) {
      const message = reason instanceof ApiError ? reason.message : fallback
      setTransfer((current) => (current ? { ...current, phase: "error", error: message } : current))
      return false
    }
  }

  return {
    transfer,
    run,
    close: () => setTransfer(null),
  }
}

export function TransferDialog({
  title,
  phase,
  loaded,
  total,
  error,
  onClose,
}: {
  title: string
  phase: TransferPhase
  loaded: number
  total: number | null
  error: string | null
  onClose: () => void
}) {
  const percent = percentOf(phase, loaded, total)
  const running = phase !== "done" && phase !== "error"

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-bark/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-title"
        aria-describedby="transfer-status"
        aria-busy={running}
        className="w-full max-w-md bg-foam p-5 shadow-xl"
      >
        <h2 id="transfer-title" className="text-xl">
          {title}
        </h2>
        <p id="transfer-status" className="mt-2 text-sm text-bark/70">
          {phaseLabel[phase]}
          {percent !== null && running ? ` · ${percent}%` : null}
        </p>
        {phase === "error" ? (
          <div className="mt-4 flex flex-col items-start gap-4">
            <Notice>{error}</Notice>
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        ) : (
          <div
            className="relative mt-4 h-1.5 overflow-hidden bg-line"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
            aria-valuetext={percent !== null ? `${percent}%` : phaseLabel[phase]}
          >
            {percent !== null ? (
              <div className="h-full bg-ink" style={{ width: `${percent}%` }} />
            ) : (
              <div className="transfer-indeterminate h-full bg-ink" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function percentOf(phase: TransferPhase, loaded: number, total: number | null): number | null {
  if (phase === "done") return 100
  if ((phase !== "uploading" && phase !== "downloading") || total === null || total <= 0) return null
  return Math.min(100, Math.round((loaded / total) * 100))
}
