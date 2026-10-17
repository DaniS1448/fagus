import { Button } from "./controls"

export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (page: number) => void
}) {
  if (pages <= 1) return null
  return (
    <nav aria-label="Paginación" className="mt-6 flex flex-wrap items-center gap-2">
      <Button variant="quiet" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span className="text-sm text-bark/70">
        Página {page} de {pages}
      </span>
      <Button variant="quiet" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Siguiente
      </Button>
    </nav>
  )
}
