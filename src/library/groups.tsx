import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { ApiError, apiGet, apiJson } from "../api"
import type { ItemGroup } from "../domain/models"
import { Button, ConfirmButton, Field, Notice, Select, TextInput } from "../ui/controls"
import { LibraryTransfer } from "./LibraryTransfer"
import { BULK_LIMIT } from "./search"

export type DrawerFilter = "all" | "none" | string
type Kind = "quotes" | "bible" | "identities"

const paths: Record<Kind, { groups: string; items: string; groupKey: string }> = {
  quotes: { groups: "/api/quote-groups", items: "/api/quotes", groupKey: "quote-groups" },
  bible: { groups: "/api/bible-groups", items: "/api/bible-texts", groupKey: "bible-groups" },
  identities: { groups: "/api/identity-groups", items: "/api/identities", groupKey: "identity-groups" },
}

export function openGroupId(filter: DrawerFilter): string | null {
  return filter === "all" || filter === "none" ? null : filter
}

export function inDrawer<T extends { groupId: string | null }>(items: T[], filter: DrawerFilter): T[] {
  if (filter === "all") return items
  if (filter === "none") return items.filter((item) => item.groupId == null)
  return items.filter((item) => item.groupId === filter)
}

export function GroupShelf({
  kind,
  filter,
  onFilter,
  dissolveCopy,
}: {
  kind: Kind
  filter: DrawerFilter
  onFilter: (filter: DrawerFilter) => void
  dissolveCopy: string
}) {
  const queryClient = useQueryClient()
  const route = paths[kind]
  const groups = useQuery({ queryKey: [route.groupKey], queryFn: () => apiGet<ItemGroup[]>(route.groups) })
  const [creating, setCreating] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const active = groups.data?.find((group) => group.id === filter) ?? null

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: [route.groupKey] })
  }

  const createGroup = useMutation({
    mutationFn: () => apiJson<ItemGroup>(route.groups, "POST", { name: groupName }),
    onSuccess: async (group) => {
      setGroupName("")
      setCreating(false)
      setError(null)
      onFilter(group.id)
      await refresh()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo crear la agrupación"),
  })

  const renameGroup = useMutation({
    mutationFn: (name: string) => apiJson<ItemGroup>(`${route.groups}/${filter}`, "PATCH", { name }),
    onSuccess: async () => {
      setError(null)
      await refresh()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudo renombrar"),
  })

  const dissolve = useMutation({
    mutationFn: () => apiJson<void>(`${route.groups}/${filter}`, "DELETE"),
    onSuccess: async () => {
      setError(null)
      onFilter("none")
      await refresh()
    },
  })

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <DrawerButton pressed={filter === "all"} onClick={() => onFilter("all")}>
          Todas
        </DrawerButton>
        <DrawerButton pressed={filter === "none"} onClick={() => onFilter("none")}>
          Sin agrupar
        </DrawerButton>
        {groups.data?.map((group) => (
          <DrawerButton key={group.id} pressed={filter === group.id} onClick={() => onFilter(group.id)}>
            {group.name}
          </DrawerButton>
        ))}
        <Button variant="quiet" onClick={() => setCreating(true)}>
          Nueva agrupación
        </Button>
      </div>
      {creating ? (
        <form
          className="mt-3 flex max-w-md flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            createGroup.mutate()
          }}
        >
          <Field label="Nombre del cajón">
            <TextInput value={groupName} onChange={(event) => setGroupName(event.target.value)} />
          </Field>
          <Button type="submit" disabled={groupName.trim().length === 0 || createGroup.isPending}>
            Crear agrupación
          </Button>
          <Button variant="quiet" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
        </form>
      ) : null}
      {active ? (
        <GroupName
          key={active.id}
          kind={kind}
          group={active}
          dissolveCopy={dissolveCopy}
          pending={dissolve.isPending}
          onRename={(name) => renameGroup.mutate(name)}
          onDissolve={() => dissolve.mutate()}
        />
      ) : null}
      {error ? (
        <div className="mt-3">
          <Notice>{error}</Notice>
        </div>
      ) : null}
    </div>
  )
}

export function SelectionStrip({
  kind,
  ids,
  noun,
  onDone,
}: {
  kind: Kind
  ids: string[]
  noun: { one: string; many: string }
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const route = paths[kind]
  const groups = useQuery({ queryKey: [route.groupKey], queryFn: () => apiGet<ItemGroup[]>(route.groups) })
  const [moveTarget, setMoveTarget] = useState("none")
  const [error, setError] = useState<string | null>(null)

  const move = useMutation({
    mutationFn: () =>
      apiJson<void>(`${route.items}/bulk`, "POST", {
        ids,
        op: "move",
        groupId: moveTarget === "none" ? null : moveTarget,
      }),
    onSuccess: async () => {
      setError(null)
      onDone()
      await queryClient.invalidateQueries({ queryKey: [route.groupKey] })
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudieron mover"),
  })

  const remove = useMutation({
    mutationFn: () => apiJson<void>(`${route.items}/bulk`, "POST", { ids, op: "delete" }),
    onSuccess: async () => {
      setError(null)
      onDone()
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "No se pudieron borrar"),
  })

  if (ids.length === 0) return null
  const label = ids.length === 1 ? `1 ${noun.one}` : `${ids.length} ${noun.many}`
  const tooMany = ids.length > BULK_LIMIT
  return (
    <div className="mt-4 flex flex-wrap items-end gap-2 border border-line bg-white/70 p-3">
      <p className="pb-2 text-sm">{label}</p>
      <Field label="Mover a">
        <Select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
          <option value="none">Sin agrupar</option>
          {groups.data?.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button variant="quiet" disabled={move.isPending || tooMany} onClick={() => move.mutate()}>
        Mover
      </Button>
      {tooMany ? (
        <Button variant="danger" disabled>
          Borrar
        </Button>
      ) : (
        <ConfirmButton
          label="Borrar"
          question={ids.length === 1 ? `¿Borrar 1 ${noun.one}?` : `¿Borrar ${ids.length} ${noun.many}?`}
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      )}
      {tooMany ? <Notice>Elige como mucho 200.</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
    </div>
  )
}

export function GroupField({
  kind,
  value,
  onChange,
}: {
  kind: Kind
  value: string
  onChange: (value: string) => void
}) {
  const route = paths[kind]
  const groups = useQuery({ queryKey: [route.groupKey], queryFn: () => apiGet<ItemGroup[]>(route.groups) })
  return (
    <Field label="Cajón">
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="none">Sin agrupar</option>
        {groups.data?.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </Select>
    </Field>
  )
}

function DrawerButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`px-3 py-2 text-sm ${pressed ? "bg-ink text-paper" : "border border-line bg-white/70"}`}
    >
      {children}
    </button>
  )
}

function GroupName({
  kind,
  group,
  dissolveCopy,
  pending,
  onRename,
  onDissolve,
}: {
  kind: Kind
  group: ItemGroup
  dissolveCopy: string
  pending: boolean
  onRename: (name: string) => void
  onDissolve: () => void
}) {
  const [name, setName] = useState(group.name)
  return (
    <form
      className="mt-4 flex max-w-xl flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        onRename(name)
      }}
    >
      <Field label="Nombre del cajón">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Button type="submit" variant="quiet" disabled={name.trim().length === 0 || name === group.name}>
        Guardar nombre
      </Button>
      <LibraryTransfer scope={kind} group={group} />
      <ConfirmButton label="Disolver" question={dissolveCopy} pending={pending} onConfirm={onDissolve} />
    </form>
  )
}
