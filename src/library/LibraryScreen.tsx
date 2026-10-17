import type { ReactNode } from "react"

export function LibraryScreen({
  title,
  lede,
  actions,
  list,
  form,
}: {
  title: string
  lede: string
  actions?: ReactNode
  list: ReactNode
  form: ReactNode
}) {
  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
      <aside className="order-1 border-b border-line bg-white/50 px-6 py-8 lg:order-2 lg:border-b-0 lg:border-l">{form}</aside>
      <section className="order-2 px-6 py-8 lg:order-1 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl">{title}</h1>
          {actions}
        </div>
        <p className="mt-2 max-w-xl text-bark/70">{lede}</p>
        <div className="mt-8">{list}</div>
      </section>
    </div>
  )
}
