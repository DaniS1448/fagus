import { Button, TextInput } from "../ui/controls"

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const ids = new Set(right)
  return left.every((id) => ids.has(id))
}

export function LibraryListTools({
  query,
  onQuery,
  matchIds,
  pageIds,
  selectedIds,
  onSelect,
}: {
  query: string
  onQuery: (query: string) => void
  matchIds: readonly string[]
  pageIds: readonly string[]
  selectedIds: readonly string[]
  onSelect: (ids: string[]) => void
}) {
  const searching = query.trim().length > 0
  return (
    <div className="mt-4 flex flex-col gap-3">
      <TextInput value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar" aria-label="Buscar" />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="quiet"
          disabled={matchIds.length === 0 || sameIds(selectedIds, matchIds)}
          onClick={() => onSelect([...matchIds])}
        >
          Seleccionar todo
        </Button>
        <Button
          variant="quiet"
          disabled={pageIds.length === 0 || sameIds(selectedIds, pageIds)}
          onClick={() => onSelect([...pageIds])}
        >
          Seleccionar esta página
        </Button>
        <Button variant="quiet" disabled={selectedIds.length === 0} onClick={() => onSelect([])}>
          Seleccionar nada
        </Button>
      </div>
      {searching ? (
        <p className="text-sm text-bark/70">
          {matchIds.length === 0 ? "Nada coincide." : matchIds.length === 1 ? "1 coincidencia" : `${matchIds.length} coincidencias`}
        </p>
      ) : null}
    </div>
  )
}
